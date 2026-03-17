# Future Plan: Recursive Supply Chain Traversal

## 概要

Data Explorer の ads.txt ビューにおけるホップ数計算を、現在の静的推定（`relationship` × `seller_type` の組み合わせ判定）から、sellers.json を再帰的にたどる**完全なサプライチェーン探索**へ進化させる設計方針を定義する。

探索は**段階的な深度拡張**で実施する。各フェーズを実施する前に調査スクリプトでデータ規模と効果を見積もり、コストと効果のバランスを確認してから次の深度へ進む。

---

## 現状と課題

### 現在の実装（フロントエンド静的推定）

```
DIRECT                              → 1 hop（固定）
RESELLER + seller_type=PUBLISHER    → 2 hops（固定）
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

## 段階的深度拡張アプローチ

### 基本方針

170万規模のエントリを一括で再帰取得するのは現実的でない。代わりに、**深度の上限を段階的に引き上げる**ことで、コストを分散しながら精度を改善する。

```
現状（depth=1 解決済み）  表示: 1, 2, 3+
                ↓ Phase A 実施
depth=2 解決    表示: 1, 2, 3, 4+
                ↓ Phase B 実施
depth=3 解決    表示: 1, 2, 3, 4, 5+
                ↓ Phase C 実施（必要な場合のみ）
depth=4 解決    表示: 1, 2, 3, 4, 5, 6+
```

`+` サフィックスは「現在の解決限界以上」を意味し、探索深度が上がるほど `+` の出現が減る。

### なぜ指数的爆発が抑制されるか

各深度で追加されるドメイン数は、チェーンの**終端効果**により逓減する：

- 多くのチェーンは depth=2〜3 で PUBLISHER に到達して終端する
- 実広告業界のサプライチェーンは現実的に 4〜5 hop 以内に収まる
- 各フェーズの実施判断スクリプトで事前に規模を確認してから進む

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

## フェーズ実施判断プロセス

各フェーズを実施する前に、以下の調査スクリプトを実行して**実施コスト（取得ドメイン数）と期待効果（解決率改善）を見積もる**。

### Step 0: ベースライン確認（実装開始前）

現在の DB の状態と、depth=2 拡張の規模を把握する。

```sql
-- 1. sellers_catalog の全体規模
SELECT
  seller_type,
  COUNT(*)              AS entry_count,
  COUNT(DISTINCT domain) AS ssp_count
FROM sellers_catalog
GROUP BY seller_type
ORDER BY entry_count DESC;

-- 2. INTERMEDIARY エントリの seller_domain 分布
--    → depth=2 で取得が必要なドメインの母数
SELECT
  COUNT(*)                               AS total_intermediary_entries,
  COUNT(DISTINCT seller_domain)          AS unique_target_domains,
  COUNT(DISTINCT domain)                 AS from_how_many_ssps,
  COUNT(*) FILTER (WHERE seller_domain IS NULL OR seller_domain = '')
                                         AS missing_seller_domain
FROM sellers_catalog
WHERE seller_type = 'INTERMEDIARY';

-- 3. depth=2 の新規取得対象ドメイン数（未取得のもののみ）
SELECT COUNT(DISTINCT sc.seller_domain) AS depth2_new_domains
FROM sellers_catalog sc
WHERE sc.seller_type = 'INTERMEDIARY'
  AND sc.seller_domain IS NOT NULL
  AND sc.seller_domain != ''
  AND NOT EXISTS (
    SELECT 1 FROM raw_sellers_files rsf
    WHERE rsf.domain = sc.seller_domain
  );

-- 4. 大規模 sellers.json を持つ可能性があるドメインの確認
--    （同一 seller_domain に多数のエントリが紐づく = 大規模 SSP の可能性）
SELECT
  seller_domain,
  COUNT(*) AS reference_count
FROM sellers_catalog
WHERE seller_type = 'INTERMEDIARY'
  AND seller_domain IS NOT NULL
GROUP BY seller_domain
ORDER BY reference_count DESC
LIMIT 20;
```

**判断基準**: `depth2_new_domains` が許容範囲（目安: 数百〜数千ドメイン）であれば Phase A を実施する。

---

### Step A: Phase A 完了後の評価（depth=2 取得後）

depth=2 の取得が完了したタイミングで実行し、Phase B の実施要否を判断する。

```sql
-- 5. ホップ数の分布確認
SELECT
  hop_count,
  is_resolved,
  resolved_depth,
  COUNT(*)              AS record_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM supply_chain_hops
GROUP BY hop_count, is_resolved, resolved_depth
ORDER BY hop_count NULLS LAST;

-- 6. 解決率サマリー
SELECT
  COUNT(*)                                                        AS total,
  COUNT(*) FILTER (WHERE is_resolved)                            AS resolved,
  COUNT(*) FILTER (WHERE NOT is_resolved)                        AS unresolved,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_resolved) / COUNT(*), 1) AS resolved_pct,
  MAX(hop_count)                                                  AS max_hop_observed
FROM supply_chain_hops;

-- 7. depth=3 の追加取得対象ドメイン数
--    （depth=2 で新たに取得した SSP の中に含まれる INTERMEDIARY の seller_domain）
SELECT COUNT(DISTINCT sc.seller_domain) AS depth3_new_domains
FROM sellers_catalog sc
WHERE sc.seller_type = 'INTERMEDIARY'
  AND sc.seller_domain IS NOT NULL
  AND sc.seller_domain != ''
  AND sc.domain IN (
    SELECT domain
    FROM supply_chain_discovery_queue
    WHERE depth = 1 AND status = 'fetched'
  )
  AND NOT EXISTS (
    SELECT 1 FROM raw_sellers_files rsf
    WHERE rsf.domain = sc.seller_domain
  );

-- 8. 未解決レコードの hop_count 下限分布（"N+" の内訳）
SELECT
  hop_count AS current_lower_bound,
  COUNT(*) AS unresolved_count
FROM supply_chain_hops
WHERE NOT is_resolved
GROUP BY hop_count
ORDER BY hop_count;
```

**判断基準**:
- `resolved_pct` が十分高い（目安: 80% 以上）→ Phase B は不要
- `depth3_new_domains` が許容範囲内 かつ `unresolved_count` が多い → Phase B を実施

---

### Step B: Phase B 完了後の評価（depth=3 取得後）

```sql
-- 9. Phase B 後の解決率比較（Phase A との差分）
SELECT
  resolved_depth,
  COUNT(*)                                                        AS total,
  COUNT(*) FILTER (WHERE is_resolved)                            AS resolved,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_resolved) / COUNT(*), 1) AS resolved_pct
FROM supply_chain_hops
GROUP BY resolved_depth
ORDER BY resolved_depth;

-- 10. depth=4 の追加取得対象ドメイン数
SELECT COUNT(DISTINCT sc.seller_domain) AS depth4_new_domains
FROM sellers_catalog sc
WHERE sc.seller_type = 'INTERMEDIARY'
  AND sc.seller_domain IS NOT NULL
  AND sc.seller_domain != ''
  AND sc.domain IN (
    SELECT domain
    FROM supply_chain_discovery_queue
    WHERE depth = 2 AND status = 'fetched'
  )
  AND NOT EXISTS (
    SELECT 1 FROM raw_sellers_files rsf
    WHERE rsf.domain = sc.seller_domain
  );
```

**判断基準**: Step A と同様。追加ドメイン数と解決率改善の費用対効果で Phase C の実施を判断する。

---

## フェーズ 1: sellers.json の段階的収集

### 1-1. 既存の Sellers Discovery ジョブの拡張

現在の `processMissingSellers()` は ads.txt の SSP ドメインを起点とする（depth=1 相当）。これを拡張して、**INTERMEDIARY が参照する seller_domain を supply_chain_discovery_queue に追加**する。

**拡張ロジック（疑似コード）**:

```
// 既存の processMissingSellers() に追加
for each sc in sellers_catalog where seller_type = 'INTERMEDIARY':
  if sc.seller_domain not in raw_sellers_files:
    enqueue(sc.seller_domain, depth = sc.source_depth + 1)

// キュー処理（既存スケジューラーに組み込み）
function processDiscoveryQueue(target_depth):
  domains = SELECT domain FROM supply_chain_discovery_queue
            WHERE status = 'pending' AND depth = target_depth
            ORDER BY depth ASC
            LIMIT 50
  for each domain:
    fetch sellers.json → save to raw_sellers_files + sellers_catalog
    update status = 'fetched'
```

**定数**:
- `MAX_DEPTH`: フェーズ判断に応じて段階的に引き上げ（初期値: 2）
- 1回の処理上限: 50 ドメイン（既存と同じ）
- 実行間隔: 既存スケジューラーに追随

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
    is_resolved       BOOLEAN DEFAULT false,  -- TRUE = チェーン終端（PUBLISHER）到達
    resolved_depth    INT NOT NULL DEFAULT 1, -- 何 depth まで探索したか
    chain_path        TEXT[],        -- 経路ドメイン配列（デバッグ用）
    computed_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (publisher_domain, ssp_domain, account_id, file_type)
);

CREATE INDEX idx_sch_publisher ON supply_chain_hops (publisher_domain, file_type);
```

`resolved_depth` は「現時点で何 depth まで探索したか」を記録し、API レスポンスと表示の `+` サフィックスの根拠となる。

---

## フェーズ 3: API エンドポイント拡張

### 既存 validator エンドポイントへの hop_count 付加

```
GET /api/adstxt/validate?domain=publisher.com&type=ads.txt&save=true
```

レスポンスの各 `record` に `hop_count` / `hop_resolved` / `resolved_depth` フィールドを追加:

```jsonc
{
  "records": [
    {
      "domain": "googlesyndication.com",
      "account_id": "pub-1234",
      "relationship": "RESELLER",
      "seller_name": "Example Publisher",
      "seller_type": "INTERMEDIARY",
      "hop_count": 3,            // 事前計算済みキャッシュから取得
      "hop_resolved": false,     // false = 現在の解決限界以上の可能性あり
      "resolved_depth": 2        // depth=2 まで探索済み → "3+" の表示根拠
    }
  ]
}
```

- `hop_resolved: true` → hop_count が確定値（チェーン終端まで到達）
- `hop_resolved: false` → hop_count は下限値（`resolved_depth` まで探索した結果）
- フィールドが存在しない場合はフロントエンドの静的推定にフォールバック

---

## フェーズ 4: フロントエンド表示更新

現在の `getHopCount()` 関数はフォールバックとして残し、バックエンドから `hop_count` が返る場合はそちらを優先する。

```typescript
// explorer-result.tsx の更新イメージ
function getHopCount(r: ValidationRecord): { label: string; resolved: boolean } {
  if (r.hop_count !== undefined) {
    const label = r.hop_resolved
      ? `${r.hop_count}`       // 確定値: "3"
      : `${r.hop_count}+`      // 下限値: "3+"（resolved_depth まで探索済み）
    return { label, resolved: r.hop_resolved ?? false }
  }
  // フォールバック: 既存の静的推定
  const estimated = estimateHopCount(r)
  return { label: estimated !== null ? `${estimated}+` : '?', resolved: false }
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
  └─ sellers_catalog の INTERMEDIARY エントリを走査（target_depth まで）
       └─ 未取得ドメインを supply_chain_discovery_queue へ追加
            └─ キューを処理して sellers.json を段階的取得（depth 昇順）

[新規] hop 事前計算ジョブ
  └─ 新しく取得した sellers.json を契機に supply_chain_hops を更新
       └─ 再帰 CTE で各 (publisher, ssp, account_id) のホップ数を計算
            └─ resolved_depth を現在の MAX_DEPTH で更新
```

---

## リスクと対策

| リスク | 対策 |
|--------|------|
| sellers.json が存在しないドメイン | `supply_chain_discovery_queue.status = 'failed'` で記録、リトライ上限設定 |
| 循環参照（A→B→A） | `visited_domains` 配列による重複チェック |
| チェーン深度の爆発 | 段階的拡張 + 調査スクリプトで規模確認後に MAX_DEPTH を引き上げ |
| DB 肥大化 | `supply_chain_discovery_queue` は取得済みエントリを定期削除 |
| 計算コスト | 事前計算キャッシュ（`supply_chain_hops`）でクエリタイムをゼロに近づける |

---

## 実装優先順位

```
Step 0: 調査スクリプト実行（ベースライン確認・depth=2 規模の見積もり）
  ↓ 規模が許容範囲内なら
Phase 1: supply_chain_discovery_queue テーブル作成 + 発見ジョブ追加（MAX_DEPTH=2）
Phase 2: supply_chain_hops テーブル作成 + 再帰 CTE 実装
Phase 3: validator API に hop_count / hop_resolved / resolved_depth フィールド追加
Phase 4: フロントエンドで "N" vs "N+" の表示切り替え

  ↓ Step A 調査スクリプト実行（depth=2 完了後の評価・depth=3 規模の見積もり）
Phase A: MAX_DEPTH を 3 に引き上げてキューを再処理
  ↓ Step B 調査スクリプト実行
Phase B: MAX_DEPTH を 4 に引き上げ（必要な場合のみ）
```

Phase 1 完了時点で sellers.json データの網羅率が向上し、現在の静的推定精度も間接的に改善する。
各 Step の調査スクリプト結果をもとにコストと効果を評価し、次フェーズの実施を判断する。

---

## 関連ファイル

| ファイル | 関連 |
|---------|------|
| `backend/src/db/init.sql` | 新テーブルの追加先 |
| `backend/src/services/sellers_service.ts` | 発見ジョブのベース実装 |
| `backend/src/services/adstxt_service.ts` | hop_count をレスポンスに付加する箇所 |
| `frontend/src/components/explorer/explorer-result.tsx` | `getHopCount()` の拡張箇所 |
| `frontend/src/hooks/use-ads-txt-data.ts` | `ValidationRecord` 型の拡張箇所 |
