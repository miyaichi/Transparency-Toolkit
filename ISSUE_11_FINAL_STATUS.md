# Issue #11: sellers.json 検索失敗 - 最終状況レポート

## 📊 Status: **RESOLVED** ✅

---

## 🎯 解決された問題

### 症状（修正前）
```
nytimes.com の ads.txt:
  kargo.com, 9123, DIRECT

表示されていたエラー:
  validation_key: "noSellersJson"
  warning_message: "sellers.json file not found for {{domain}}"
```

### 正しい動作（修正後）
```
  validation_key: "directAccountIdNotInSellersJson"
  warning_message: "DIRECT entry account ID '9123' not found in sellers.json"
```

---

## 🔍 根本原因（3層構造）

### 原因1: adstxt-validator のバグ（v1.2.6）
`validateWithOptimizedProvider()` で `hasSellerJson()` が `true` を返しても、
`batchGetSellers()` でマッチするセラーが0件の場合に `sellersMap` が空になり、
`validateSingleRecordOptimized()` が sellers.json 不在と誤判定していた。

```typescript
// 修正前（バグ）
validationResult.hasSellerJson = sellersMap.size > 0 || Object.keys(metadata).length > 0;
// → kargo.com の sellers.json は存在するが ID 9123 がないため sellersMap は空
// → false と判定 → noSellersJson を誤返却

// 修正後（v1.2.7）
// domainHasSellersJsonMap で hasSellerJson() の結果を明示的に追跡
domainHasSellersJsonMap.set(domain, true); // hasSellerJson = true の場合
const hasSellersJson = domainHasSellersJsonMap.get(domain) ?? ...;
// validateSingleRecordOptimized に hasSellersJson: true を渡す
```

### 原因2: Transparency Toolkit の警告メッセージ展開バグ
`adstxt_service.ts` で `createValidationMessage()` に空配列を渡していたため、
`{{domain}}` などのプレースホルダーが展開されていなかった。

```typescript
// 修正前（バグ）
const msg = createValidationMessage(record.validation_key, [], 'en');
// → placeholders = [] → {{domain}} が展開されない

// 修正後
const params = record.warning_params || {};
const placeholders = [
  params.domain || record.domain || '',
  params.accountId || record.account_id || '',
  params.sellerDomain || '',
  params.accountType || record.account_type || '',
];
const msg = createValidationMessage(record.validation_key, placeholders, 'en');
```

### 原因3: Cloud Run トラフィック固定（デプロイ不反映）
以前のデバッグ中に `gcloud run services update-traffic --to-revisions 00049-9j6=100`
で手動固定されたため、その後の GitHub Actions デプロイ（00056〜00058）が
新リビジョンを作成しても、トラフィックが旧リビジョンに留まっていた。

```bash
# 修正（手動）
gcloud run services update-traffic ttkit-backend \
  --to-revisions ttkit-backend-00058-gt7=100 \
  --region asia-northeast1 --project apti-ttkit

# 再発防止: deploy-gcp.yml に以下を追加
gcloud run services update-traffic ${{ env.BACKEND_SERVICE }} \
  --to-latest \
  --region ${{ env.REGION }} \
  --project ${{ env.PROJECT_ID }}
```

---

## ✅ 修正内容一覧

| ファイル | 修正内容 | コミット/バージョン |
|---------|---------|----------------|
| adstxt-validator/src/index.ts | `domainHasSellersJsonMap` 追加で noSellersJson 誤判定を修正 | npm v1.2.7 |
| Transparency-Toolkit/backend/src/services/adstxt_service.ts | `warning_params` を placeholders に変換してメッセージ展開 | c726c03 |
| Transparency-Toolkit/backend/package.json | adstxt-validator ^1.2.7 に更新 | c726c03 |
| Transparency-Toolkit/.github/workflows/deploy-gcp.yml | `--to-latest` ステップ追加で再発防止 | 948b8f5 |

---

## 📅 解決日時

**2026-02-28** JST

---

**レポート更新日時:** 2026-02-28 (Resolved)
