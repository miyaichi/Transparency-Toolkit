# Public API 仕様・ロードマップ

## 概要

Transparency-Toolkit のデータを外部ユーザー（パートナー企業、研究者、開発者）が安全にアクセスできる公開 API の仕様とロードマップ。

---

## 技術スタック

```
言語:         TypeScript + Node.js
フレームワーク: Hono + @hono/zod-openapi
データベース:   PostgreSQL (Cloud SQL)
ホスティング:   Cloud Run
ドキュメント:   OpenAPI 3.0 (自動生成) → /doc, /ui
```

---

## Base URL

```
https://ttkit.apti.jp
```

---

## 認証

すべての `/v1/*` エンドポイントは API Key 認証が必要。

```http
X-API-Key: <api_key>
```

API Key は APTI 承認後に手動発行（将来的にはセルフサービスポータル予定）。

---

## レート制限

| 制限 | デフォルト値 |
|------|------------|
| per minute | 10 req/min per API Key |
| per day    | 100 req/day per API Key |
| IP ベース  | 120 req/min per IP（全エンドポイント共通） |

レート制限ヘッダー（per-minute 値を返す）:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1711512000
Retry-After: 45   # 429 時のみ
```

---

## エンドポイント

### GET /v1/adstxt/validate

単一ドメインの ads.txt 検証結果を取得。

**リクエスト:**

```http
GET /v1/adstxt/validate?domain=nikkei.com
X-API-Key: <api_key>
```

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `domain`  | ✓ | 検証対象ドメイン（例: `nikkei.com`） |
| `type`    |   | `ads.txt`（デフォルト）または `app-ads.txt` |
| `lang`    |   | `en`（デフォルト）または `ja` |

**レスポンス (200 OK):**

```json
{
  "domain": "nikkei.com",
  "ads_txt_url": "https://nikkei.com/ads.txt",
  "records": [
    {
      "line_number": 10,
      "raw_line": "subdomain=asia.nikkei.com",
      "is_valid": true,
      "variable_type": "SUBDOMAIN",
      "value": "asia.nikkei.com"
    },
    {
      "line_number": 16,
      "raw_line": "google.com, pub-1234567890, DIRECT, f08c47fec0942fa0",
      "is_valid": true,
      "domain": "google.com",
      "account_id": "pub-1234567890",
      "account_type": "DIRECT",
      "certification_authority_id": "f08c47fec0942fa0",
      "has_warning": false,
      "seller_name": "Example Publisher",
      "seller_type": "PUBLISHER"
    }
  ],
  "stats": {
    "total": 150,
    "valid": 148,
    "invalid": 2,
    "warnings": 5
  }
}
```

---

### GET /v1/sellers/lookup

sellers.json カタログから特定セラーを検索。

**リクエスト:**

```http
GET /v1/sellers/lookup?domain=google.com&seller_id=pub-1234567890
X-API-Key: <api_key>
```

| パラメータ  | 必須 | 説明 |
|------------|------|------|
| `domain`   | ✓ | SSP ドメイン（例: `google.com`） |
| `seller_id`| ✓ | セラー ID（例: `pub-1234567890`） |

**レスポンス (200 OK):**

```json
{
  "domain": "google.com",
  "seller_id": "pub-1234567890",
  "found": true,
  "seller": {
    "seller_id": "pub-1234567890",
    "domain": "google.com",
    "seller_domain": "publisher.com",
    "seller_type": "PUBLISHER",
    "name": "Example Publisher Inc.",
    "is_confidential": false,
    "updated_at": "2026-03-25T10:00:00Z"
  }
}
```

**見つからない場合 (200 OK):**

```json
{
  "domain": "google.com",
  "seller_id": "pub-1234567890",
  "found": false,
  "seller": null
}
```

---

## エラーレスポンス

```json
{
  "error": "error_code",
  "message": "Human-readable message"
}
```

| HTTP | error_code | 説明 |
|------|-----------|------|
| 400 | `invalid_domain` | ドメイン形式が不正 |
| 400 | `invalid_params` | 必須パラメータが欠落 / 不正 |
| 400 | `not_found` | ads.txt が存在しない |
| 401 | `missing_api_key` | X-API-Key ヘッダーなし |
| 401 | `invalid_api_key` | API Key が無効 |
| 403 | `api_key_disabled` | API Key が無効化 / 期限切れ |
| 429 | `rate_limit_exceeded` | レート制限超過 |
| 500 | `internal_error` | サーバー内部エラー |

---

## データ鮮度

| データ | 更新頻度 |
|--------|---------|
| ads.txt 検証結果 | 毎日スキャン（最新スキャン結果を返す） |
| sellers.json カタログ | 週次更新 |

---

## DB スキーマ（API Key 管理）

```sql
CREATE TABLE api_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash          VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of raw key
  key_prefix        VARCHAR(8)  NOT NULL,         -- 表示用プレフィックス (例: "ttkit_ab")
  name              VARCHAR(255) NOT NULL,
  email             VARCHAR(255) NOT NULL,
  organization      VARCHAR(255),
  rate_limit_day    INTEGER DEFAULT 100,
  rate_limit_minute INTEGER DEFAULT 10,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  last_used_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  metadata          JSONB
);

CREATE TABLE api_usage_logs (
  id              BIGSERIAL PRIMARY KEY,
  api_key_id      UUID REFERENCES api_keys(id),
  endpoint        VARCHAR(255) NOT NULL,
  method          VARCHAR(10)  NOT NULL,
  status_code     INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address      INET,
  user_agent      TEXT,
  timestamp       TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ロードマップ

### Phase 1 — 完了

- [x] API Key 認証ミドルウェア
- [x] `GET /v1/adstxt/validate`
- [x] `GET /v1/sellers/lookup`
- [x] per-API-Key レート制限（in-memory）
- [x] エラーハンドリング
- [x] DBマイグレーション（`migrate:06`）

### Phase 2 — 予定

- [ ] `api_usage_logs` への非同期書き込み
- [ ] API Key 管理 CRUD（管理者向け内部 API）
- [ ] 使用状況ダッシュボード
- [ ] Redis によるレート制限（Cloud Run マルチインスタンス対応）
- [ ] `force_refresh` パラメータ（Enterprise 向け）
- [ ] OpenAPI ドキュメント公開（`https://docs.ttkit.apti.jp/api/`）

### Phase 3 — 将来

- [ ] `POST /v1/adstxt/batch`（非同期バッチ検証）
- [ ] Webhook 通知
- [ ] 統計データ API（`GET /v1/stats/summary`）
- [ ] レート制限プラン（Free / Standard / Enterprise）
- [ ] OAuth 2.0（APTI ドメインメール限定）
- [ ] CSV / JSON バルクエクスポート

---

## セキュリティ

- HTTPS 必須（Cloud Run がデフォルトで強制）
- API Key は SHA-256 ハッシュのみ DB 保存（平文保存なし）
- CORS: `/v1/*` は任意オリジン許可（API Key が認証手段のため）、`/api/*` は `FRONTEND_URL` 制限
- ドメインバリデーション（SSRF 対策）: `localhost` / `127.0.0.1` / `::1` を拒否
- SQL インジェクション対策: パラメータ化クエリ徹底

---

**作成日**: 2026-03-27
**バージョン**: 2.0
