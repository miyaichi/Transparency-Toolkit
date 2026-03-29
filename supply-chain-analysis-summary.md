# Supply Chain Discovery & Hop Calculation - 分析サマリー
**日時:** 2026-03-29 12:00 JST

## 📊 実施内容

### 1. Discovery クエリの改善
**変更内容:**
```sql
-- 追加フィルター:
AND sc.seller_domain NOT LIKE '%/%'      -- パス除外
AND sc.seller_domain NOT LIKE '%?%'      -- クエリ除外
AND sc.seller_domain NOT LIKE '%#%'      -- フラグメント除外
AND sc.seller_domain NOT LIKE '%.'       -- 末尾ドット除外
AND sc.seller_domain NOT LIKE '%http:%'  -- プロトコル除外
AND sc.seller_domain NOT LIKE '%https:%' -- プロトコル除外
```

**効果:**
- dable.io の不正データ（4,090 件の "Invalid domain format" エラー）を事前にフィルタ可能
- 今後の Discovery 実行で、より高品質なドメインのみがキューに追加される

**ファイル:** `backend/src/services/supply_chain_discovery_service.ts`

---

### 2. Hop Calculator Service の実装
**ファイル:**
- `backend/src/services/hop_calculator_service_v2.ts`
- `backend/src/scripts/calculate_hops.ts`

**現在の実装:**
- DIRECT/PUBLISHER sellers を hop=1 として供給_chain_hops に挿入
- INTERMEDIARY sellers を追跡してホップ数を計算

**結果（部分実行）:**
```
Total hops calculated: 2,446,682
├─ Resolved: 2,444,414 (99.9%)
└─ Unresolved: 2,268 (0.1%)

Hop distribution:
├─ hop=1: 2,444,411 (100%)
└─ hop=2: 3 (0.00%)

Max hop: 2
Avg hop: 1.00
```

**課題:**
- **ほとんどが hop=1**（DIRECT/PUBLISHER）
- **hop=3+ がほぼ存在しない**

---

## 🔍 根本原因の分析

### seller_catalog の構造確認

**INTERMEDIARY チェーンの追跡:**

```sql
-- INTERMEDIARY -> seller_domain -> 次のドメインの sellers を確認
SELECT
  sc1.domain as origin,
  sc1.seller_domain as next_domain,
  COUNT(DISTINCT sc2.seller_id) FILTER (WHERE sc2.seller_type IN ('PUBLISHER', 'DIRECT')) as publishers,
  COUNT(DISTINCT sc2.seller_id) FILTER (WHERE sc2.seller_type = 'INTERMEDIARY') as intermediaries,
  COUNT(DISTINCT sc2.seller_id) as total
FROM sellers_catalog sc1
LEFT JOIN sellers_catalog sc2 ON sc2.domain = sc1.seller_domain
WHERE sc1.seller_type = 'INTERMEDIARY'
GROUP BY sc1.domain, sc1.seller_domain
LIMIT 20;
```

**結果:**
- ✅ 次のドメインに sellers が存在する（例: aax.media に 16 DIRECT + 4 INTERMEDIARY）
- ✅ チェーンが実際に存在している
- ❌ 現在のホップ計算ロジックが正しくチェーンを追跡できていない

---

## ✅ 現在のフロントエンド表示ロジック

**ファイル:** `frontend/src/components/explorer/explorer-result.tsx`

```typescript
function getHopCount(r: ValidationRecord): number | null {
  if (!isExchangeEntry(r)) return null
  if (!isFoundInSellers(r)) return null

  const rel = r.relationship?.toUpperCase()
  if (rel === "DIRECT") return 1
  if (rel === "RESELLER") {
    const st = r.seller_type?.toUpperCase()
    if (st === "INTERMEDIARY") return 3  // ← "3+" として表示
    return 2
  }
  return null
}
```

**このロジックは推測ベース:**
- DIRECT → 1 hop
- RESELLER + PUBLISHER/BOTH → 2 hops
- RESELLER + INTERMEDIARY → 3（実際は 3+ の可能性）

**問題点:**
- 実際のホップ数は 3, 4, 5... とさらに深い可能性がある
- supply_chain_hops テーブルのデータを使っていない

---

## 🎯 次のステップ

### 優先度 1: Hop Calculator のロジック修正
**現在の問題:**
- INTERMEDIARY を追跡する際、同じ seller_id で次のドメインを検索している
- 正しくは、seller_domain に移動して、そのドメインの **任意の seller** を確認すべき

**修正方針（2つの選択肢）:**

#### Option A: Publisher ベースのホップ計算
- monitored_domains の ads.txt をパース
- 各 (publisher, SSP, account_id) についてホップを計算
- 現実的だが、実装が複雑

#### Option B: フロントエンドでのリアルタイム計算
- seller_type を使った推測ロジックを拡張
- INTERMEDIARY の場合、seller_domain を再帰的に確認
- API レスポンスに chain_path を含める
- シンプルだが、APIコールが増える可能性

### 優先度 2: Discovery の再実行
改善されたフィルターで Discovery を再実行：
```bash
# 不正ドメインをクリーンアップ
DELETE FROM supply_chain_discovery_queue WHERE status = 'failed' AND error_message = 'Invalid domain name format';

# Discovery を再実行（改善されたフィルター適用）
# ... (手順は別途確認)
```

### 優先度 3: データエクスプローラーでの表示確認
- 現在の "3+" 表示が実際のデータとどれくらい一致しているか検証
- 改善後のホップ計算結果と比較

---

## 📝 まとめ

### ✅ 完了
1. Discovery クエリの改善（不正ドメインフィルター強化）
2. Hop Calculator Service の基本実装
3. supply_chain_hops テーブルへのデータ投入（部分）

### ⏳ 継続中
- Hop Calculator のロジック修正が必要
- 現在の実装では hop=2 までしか検出できていない

### 🚨 課題
- INTERMEDIARY チェーンの正しい追跡方法の実装
- フロントエンドとの統合（API に hop_count を追加）

### 💡 推奨アクション
1. **短期:** 現在の推測ベースのロジック（seller_type）をそのまま使用
   - "3+" は INTERMEDIARY の存在を示す指標として有効
   - 完全に正確ではないが、概ね正しい

2. **中期:** Hop Calculator の Option B を実装
   - API レスポンスに chain_path を追加
   - フロントエンドで実際のホップ数を表示

3. **長期:** Publisher ベースの完全なホップ計算（Option A）
   - より正確だが、実装とパフォーマンスのコストが高い
