# Future Plan: Recursive Supply Chain Traversal

## 概要

Data Explorer の ads.txt ビューにおけるホップ数計算を、現在の静的推定（`relationship` × `seller_type` の組み合わせ判定）から、sellers.json を再帰的にたどる**完全なサプライチェーン探索**へ進化させる設計方針を定義する。

---

## 現状と課題

### 現在の実装（フロントエンド静的推定）

```
DIRECT                          → 1 hop（固定）
RESELLER + seller_type=PUBLISHER → 2 hops（固定）
RESELLER + seller_type=INTERMEDIARY → 3+（不確定）
```

| 利点 | 課題 |
|------|------|
| 追加の API コールなし | INTERMEDIARY のチェーン深度が不明 |
| パフォーマンス影響ゼロ | 実際のサプライパスを追跡できない |
| 現在の DB データで完結 | 「3+」は推定値にすぎない |

### 完全探索に必要なもの

パブリッシャー → SSP1 → SSP2 → ... → 最終パブリッシャー という連鎖をたどるには：

1. 各中間 SSP の **sellers.json が DB にインデックス済み**であること
2. チェーンを再帰的にたどる**クエリまたはサービスロジック**
3. 探索済みデータを事前に揃える**スケジュールジョブ**

---

## アーキテクチャ設計

### サプライチェーンの構造

```
[Publisher domain]
  ads.txt:  ssp1.com, pub-111, RESELLER

[ssp1.com の sellers.json]
  seller_id: pub-111
  seller_type: INTERMEDIARY
  seller_domain: reseller.com       ← 次のホップ先ドメイン

[reseller.com の sellers.json]
  seller_id: reseller-456
  seller_type: PUBLISHER
  seller_domain: publisher.com      ← チェーン終端
```

> **制約**: sellers.json エントリには「次の seller_id」が明示されない。
> 連鎖追跡は `(ssp_domain → seller_domain)` のドメイン間リンクを基軸とし、
> 各ドメインの sellers.json における PUBLISHER エントリの存在で終端を判定する。

---

## フェーズ 1: sellers.json の網羅的収集

### 1-1. 既存の Sellers Discovery ジョブの拡張

現在の Sellers Discovery は監視対象ドメインの SSP を収集するが、**INTERMEDIARY が参照するドメイン**までは追跡していない。

**拡張ロジック（疑似コード）**:

```
function discoverChain(domain, depth=0, visited=Set):
  if depth > MAX_DEPTH or domain in visited: return
  visited.add(domain)

  fetch sellers.json for domain → save to raw_sellers_files + sellers_catalog

  for each seller where seller_type = INTERMEDIARY:
    if seller.seller_domain not in sellers_catalog:
      enqueue(seller.seller_domain, depth+1)  ← 新規ドメインをキューへ
```

**定数**:
- `MAX_DEPTH`: 5（循環・無限ループ防止）
- 実行間隔: 既存 sellers.json スキャンに追随（変更なし）

### 1-2. 発見キューテーブル（新規）

```sql
CREATE TABLE IF NOT EXISTS supply_chain_discovery_queue (
    domain          TEXT PRIMARY KEY,
    discovered_from TEXT NOT NULL,          -- 発見元ドメイン
    depth           INT  NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending / fetched / failed
    queued_at       TIMESTAMPTZ DEFAULT NOW(),
    fetched_at      TIMESTAMPTZ
);

CREATE INDEX idx_scdq_status ON supply_chain_discovery_queue (status, depth);
```

`depth` が小さい（直接の SSP に近い）ものを優先処理する。

---

## フェーズ 2: DB によるホップ数計算

全 sellers.json データが揃っていれば、外部通信なしに **PostgreSQL の再帰 CTE 一本**でホップ数を解決できる。

### 再帰 CTE クエリ（設計案）

```sql
WITH RECURSIVE supply_chain AS (
  -- ベースケース: ads.txt の直接エントリ
  SELECT
    $publisher_domain::TEXT    AS publisher,
    $ssp_domain::TEXT          AS current_domain,
    $account_id::TEXT          AS current_seller_id,
    sc.seller_type,
    sc.seller_domain,
    sc.name,
    1                          AS hop,
    ARRAY[$ssp_domain]         AS visited_domains  -- 循環検出
  FROM sellers_catalog sc
  WHERE sc.domain = $ssp_domain
    AND sc.seller_id = $account_id

  UNION ALL

  -- 再帰: INTERMEDIARY の場合にさらに追跡
  SELECT
    chain.publisher,
    sc.domain,
    sc.seller_id,
    sc.seller_type,
    sc.seller_domain,
    sc.name,
    chain.hop + 1,
    chain.visited_domains || sc.domain
  FROM supply_chain chain
  JOIN sellers_catalog sc
    ON sc.domain = chain.seller_domain
  WHERE chain.seller_type = 'INTERMEDIARY'
    AND chain.hop < 10                          -- 最大深度
    AND NOT (sc.domain = ANY(chain.visited_domains)) -- 循環防止
)
SELECT MAX(hop) AS max_hop, AVG(hop) AS avg_hop, *
FROM supply_chain
ORDER BY hop DESC;
```

### キャッシュテーブル（事前計算）

リアルタイムクエリは負荷が大きいため、スケジュールジョブで事前に計算してキャッシュする。

```sql
CREATE TABLE IF NOT EXISTS supply_chain_hops (
    publisher_domain  TEXT NOT NULL,
    ssp_domain        TEXT NOT NULL,
    account_id        TEXT NOT NULL,
    file_type         TEXT NOT NULL DEFAULT 'ads.txt',
    hop_count         INT,           -- NULL = 解決不能（循環・未取得）
    is_resolved       BOOLEAN DEFAULT false,
    chain_path        TEXT[],        -- 経路ドメイン配列（デバッグ用）
    computed_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (publisher_domain, ssp_domain, account_id, file_type)
);

CREATE INDEX idx_sch_publisher ON supply_chain_hops (publisher_domain, file_type);
```

---

## フェーズ 3: API エンドポイント拡張

### 既存 validator エンドポイントへの hop_count 付加

```
GET /api/adstxt/validate?domain=publisher.com&type=ads.txt&save=true
```

レスポンスの各 `record` に `hop_count` フィールドを追加:

```jsonc
{
  "records": [
    {
      "domain": "googlesyndication.com",
      "account_id": "pub-1234",
      "relationship": "RESELLER",
      "seller_name": "Example Publisher",
      "seller_type": "INTERMEDIARY",
      "hop_count": 3,          // ← 事前計算済みキャッシュから取得
      "hop_resolved": true     // ← false の場合は推定値
    }
  ]
}
```

`hop_resolved: false` の場合はフロントエンドの静的推定値にフォールバックする。

---

## フェーズ 4: フロントエンド表示更新

現在の `getHopCount()` 関数はフォールバックとして残し、バックエンドから `hop_count` が返る場合はそちらを優先する。

```typescript
// explorer-result.tsx の更新イメージ
function getHopCount(r: ValidationRecord): { count: number | null; resolved: boolean } {
  if (r.hop_count !== undefined) {
    return { count: r.hop_count, resolved: r.hop_resolved ?? false }
  }
  // フォールバック: 既存の静的推定
  const estimated = estimateHopCount(r)
  return { count: estimated, resolved: false }
}
```

表示バッジに「解決済み」と「推定値」を区別するインジケーターを追加する（例: 実線バッジ vs 破線バッジ）。

---

## スケジュールジョブ全体像（変更後）

```
[既存] ads.txt スキャン（20160分間隔）
  └─ SSP ドメイン → monitored_domains に登録

[既存] sellers.json 取得
  └─ monitored_domains の sellers.json を fetch → sellers_catalog へ

[新規] supply chain discovery ジョブ
  └─ sellers_catalog の INTERMEDIARY エントリを走査
       └─ 未取得ドメインを supply_chain_discovery_queue へ追加
            └─ キューを処理して sellers.json を再帰取得

[新規] hop 事前計算ジョブ
  └─ 新しく取得した sellers.json を契機に supply_chain_hops を更新
       └─ 再帰 CTE で各 (publisher, ssp, account_id) のホップ数を計算
```

---

## リスクと対策

| リスク | 対策 |
|--------|------|
| sellers.json が存在しないドメイン | `supply_chain_discovery_queue.status = 'failed'` で記録、リトライ上限設定 |
| 循環参照（A→B→A） | `visited_domains` 配列による重複チェック |
| チェーン深度の爆発 | `MAX_DEPTH = 5` でカット、実用上 4 以上はほぼ存在しない |
| DB 肥大化 | `supply_chain_discovery_queue` は取得済みエントリを定期削除 |
| 計算コスト | 事前計算キャッシュ（`supply_chain_hops`）でクエリタイムをゼロに近づける |

---

## 実装優先順位

```
Phase 1: supply_chain_discovery_queue テーブル作成 + 発見ジョブ追加
Phase 2: supply_chain_hops テーブル作成 + 再帰 CTE 実装
Phase 3: validator API に hop_count フィールド追加
Phase 4: フロントエンドで解決済み/推定値の表示切り替え
```

Phase 1 完了時点で sellers.json データの網羅率が向上し、現在の静的推定精度も間接的に改善する。

---

## 関連ファイル

| ファイル | 関連 |
|---------|------|
| `backend/src/db/init.sql` | 新テーブルの追加先 |
| `backend/src/services/sellers_service.ts` | 発見ジョブのベース実装 |
| `backend/src/services/adstxt_service.ts` | hop_count をレスポンスに付加する箇所 |
| `frontend/src/components/explorer/explorer-result.tsx` | `getHopCount()` の拡張箇所 |
| `frontend/src/hooks/use-ads-txt-data.ts` | `ValidationRecord` 型の拡張箇所 |
