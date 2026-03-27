# Transparency-Toolkit Public API Requirements

## 概要

Transparency-Toolkit のデータを外部ユーザー（パートナー企業、研究者、開発者）が安全にアクセスできるようにするための公開 API 仕様。

## 目的

- **データ共有**: ads.txt/sellers.json の検証データを外部に提供
- **セキュリティ**: 既存バックエンドを直接公開せず、認証・レート制限を実装
- **拡張性**: 将来的な機能追加（統計データ、バルクエクスポート等）に対応

## 要件

### 1. 認証・認可

#### API Key 認証
```
Header: X-API-Key: <api_key>
```

**要件:**
- API Key の発行・管理機能
- Key ごとのレート制限設定（例: 100 req/day, 10 req/min）
- Key の無効化・再発行機能
- 使用状況の追跡（リクエスト数、エンドポイント別）

**実装候補:**
- Firebase Authentication + Custom Claims
- Supabase Auth
- 独自実装（PostgreSQL で API Key テーブル管理）

#### OAuth 2.0（将来的）
- Google OAuth（APTI ドメインメール限定）
- より高度なアクセス制御が必要な場合

---

### 2. API エンドポイント

#### Base URL
```
Production: https://ttkit.apti.jp
```

#### 2.1 ads.txt 検証

**GET /v1/adstxt/validate**

単一ドメインの ads.txt 検証結果を取得。

**リクエスト:**
```http
GET /v1/adstxt/validate?domain=nikkei.com
Header: X-API-Key: <api_key>
```

**レスポンス (200 OK):**
```json
{
  "domain": "nikkei.com",
  "ads_txt_url": "https://nikkei.com/ads.txt",
  "last_scanned": "2026-03-27T05:33:42Z",
  "is_valid": true,
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
      "type": "DATA_RECORD",
      "system_domain": "google.com",
      "publisher_account_id": "pub-1234567890",
      "account_type": "DIRECT",
      "certification_authority_id": "f08c47fec0942fa0",
      "validation_warnings": [],
      "sellers_found": true
    }
  ],
  "summary": {
    "total_records": 150,
    "valid_records": 148,
    "invalid_records": 2,
    "direct_count": 25,
    "reseller_count": 123,
    "unique_systems": 45
  }
}
```

**エラー (400 Bad Request):**
```json
{
  "error": "invalid_domain",
  "message": "Domain must be a valid format (e.g., example.com)"
}
```

**エラー (404 Not Found):**
```json
{
  "error": "not_found",
  "message": "ads.txt not found for domain: example.com",
  "last_scanned": "2026-03-27T05:33:42Z"
}
```

**エラー (429 Too Many Requests):**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Limit: 10 req/min",
  "retry_after": 45
}
```

---

#### 2.2 sellers.json 検証

**GET /v1/sellers/lookup**

特定の SSP ドメインの sellers.json データを取得。

**リクエスト:**
```http
GET /v1/sellers/lookup?domain=google.com&seller_id=pub-1234567890
Header: X-API-Key: <api_key>
```

**レスポンス (200 OK):**
```json
{
  "domain": "google.com",
  "seller_id": "pub-1234567890",
  "found": true,
  "seller_data": {
    "name": "Example Publisher Inc.",
    "seller_type": "PUBLISHER",
    "is_confidential": false,
    "is_passthrough": false
  },
  "last_updated": "2026-03-25T10:00:00Z"
}
```

**レスポンス (200 OK - Not Found):**
```json
{
  "domain": "google.com",
  "seller_id": "pub-1234567890",
  "found": false,
  "last_updated": "2026-03-25T10:00:00Z"
}
```

---

#### 2.3 バッチ検証（将来的）

**POST /v1/adstxt/batch**

複数ドメインを一度に検証（非同期処理）。

**リクエスト:**
```json
{
  "domains": ["nikkei.com", "asahi.com", "yomiuri.co.jp"],
  "callback_url": "https://example.com/webhook" // Optional
}
```

**レスポンス (202 Accepted):**
```json
{
  "job_id": "batch_abc123",
  "status": "processing",
  "status_url": "/v1/jobs/batch_abc123"
}
```

**ジョブ確認 (GET /v1/jobs/{job_id}):**
```json
{
  "job_id": "batch_abc123",
  "status": "completed",
  "created_at": "2026-03-27T05:33:42Z",
  "completed_at": "2026-03-27T05:35:10Z",
  "results": [
    {
      "domain": "nikkei.com",
      "status": "success",
      "data_url": "/v1/adstxt/validate?domain=nikkei.com"
    },
    {
      "domain": "invalid-domain",
      "status": "failed",
      "error": "Domain not found"
    }
  ]
}
```

---

#### 2.4 統計データ（将来的）

**GET /v1/stats/summary**

全体統計データを取得。

**レスポンス (200 OK):**
```json
{
  "total_domains_monitored": 9844,
  "ads_txt_adoption_rate": 0.989,
  "app_ads_txt_adoption_rate": 0.856,
  "total_unique_ssp_domains": 450,
  "last_updated": "2026-03-27T00:00:00Z"
}
```

---

### 3. レート制限

#### デフォルト制限
```
- 100 requests/day per API Key
- 10 requests/minute per API Key
- 1 request/second per IP address
```

#### プランごとの制限（将来的）
```
Free Tier:       100 req/day,  10 req/min
Standard Tier:  1000 req/day,  60 req/min
Enterprise:    10000 req/day, 300 req/min
```

#### レート制限ヘッダー
```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1711512000
```

---

### 4. セキュリティ

#### 必須対策
- [x] HTTPS 必須（HTTP は 301 Redirect）
- [x] API Key ハッシュ化保存（SHA-256 + Salt）
- [x] CORS 設定（許可ドメインリスト）
- [x] SQL Injection 対策（パラメータ化クエリ）
- [x] DoS 対策（レート制限 + Cloudflare）
- [x] ロギング（API Key ごとのアクセスログ）

#### オプション
- [ ] IP ホワイトリスト（Enterprise プランのみ）
- [ ] Webhook 署名検証（HMAC-SHA256）
- [ ] API バージョニング（/v1, /v2）

---

### 5. データ鮮度

#### キャッシュ戦略
```
- ads.txt 検証結果: 24時間キャッシュ（TTL: 86400秒）
- sellers.json データ: 7日キャッシュ（TTL: 604800秒）
- 統計データ: 1時間キャッシュ（TTL: 3600秒）
```

#### キャッシュヘッダー
```http
Cache-Control: public, max-age=86400
ETag: "abc123def456"
Last-Modified: Wed, 27 Mar 2026 05:33:42 GMT
```

#### 強制再取得
```http
GET /v1/adstxt/validate?domain=nikkei.com&force_refresh=true
Header: X-API-Key: <api_key>
```

*注: force_refresh は Enterprise プランのみ利用可能*

---

### 6. エラーハンドリング

#### 標準エラーレスポンス
```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {
    "field": "domain",
    "reason": "Invalid format"
  },
  "request_id": "req_abc123",
  "timestamp": "2026-03-27T05:33:42Z"
}
```

#### エラーコード一覧
```
400 Bad Request:
  - invalid_domain: ドメイン形式が不正
  - missing_parameter: 必須パラメータが欠落
  - invalid_parameter: パラメータの値が不正

401 Unauthorized:
  - missing_api_key: API Key が提供されていない
  - invalid_api_key: API Key が無効

403 Forbidden:
  - api_key_disabled: API Key が無効化されている
  - insufficient_permissions: 権限不足

404 Not Found:
  - not_found: リソースが見つからない
  - domain_not_monitored: 監視対象外のドメイン

429 Too Many Requests:
  - rate_limit_exceeded: レート制限超過

500 Internal Server Error:
  - internal_error: サーバー内部エラー
  - database_error: データベース接続エラー

503 Service Unavailable:
  - maintenance: メンテナンス中
  - overloaded: サーバー過負荷
```

---

### 7. ドキュメント

#### 必須ドキュメント
- [ ] API リファレンス（OpenAPI 3.0 仕様書）
- [ ] Getting Started ガイド
- [ ] 認証・レート制限の説明
- [ ] エラーコード一覧
- [ ] サンプルコード（curl, Python, JavaScript）

#### 公開場所
```
https://docs.ttkit.apti.jp/api/
```

---

### 8. モニタリング・ログ

#### ログ項目
```json
{
  "timestamp": "2026-03-27T05:33:42Z",
  "api_key_hash": "sha256_abc123",
  "endpoint": "/v1/adstxt/validate",
  "method": "GET",
  "parameters": {
    "domain": "nikkei.com"
  },
  "status_code": 200,
  "response_time_ms": 245,
  "user_agent": "ttkit-cli/1.0.0",
  "ip_address": "203.0.113.42",
  "request_id": "req_abc123"
}
```

#### メトリクス
- リクエスト数（エンドポイント別、API Key 別）
- 平均レスポンスタイム
- エラー率（4xx, 5xx）
- レート制限到達回数
- キャッシュヒット率

#### アラート
- エラー率 > 5%
- 平均レスポンスタイム > 2秒
- レート制限到達回数 > 100/hour
- API Key の異常使用パターン

---

### 9. 実装ロードマップ

#### Phase 1: MVP（1-2週間）
- [x] API Key 認証実装
- [x] GET /v1/adstxt/validate エンドポイント
- [x] レート制限（メモリベース）
- [x] 基本的なエラーハンドリング
- [x] ロギング

#### Phase 2: 拡張（2-3週間）
- [ ] GET /v1/sellers/lookup エンドポイント
- [ ] Redis キャッシュ実装
- [ ] API Key 管理画面（CRUD）
- [ ] 使用状況ダッシュボード
- [ ] OpenAPI ドキュメント自動生成

#### Phase 3: 本格運用（1-2週間）
- [ ] POST /v1/adstxt/batch エンドポイント
- [ ] Webhook 通知機能
- [ ] レート制限プラン実装
- [ ] モニタリング・アラート設定
- [ ] パフォーマンス最適化

#### Phase 4: 高度な機能（将来）
- [ ] OAuth 2.0 対応
- [ ] GraphQL API
- [ ] 統計データ API
- [ ] CSV/JSON バルクエクスポート
- [ ] Webhook リトライ・署名検証

---

### 10. 技術スタック案

#### Option A: 既存バックエンド拡張
```
- 言語: TypeScript + Node.js (既存)
- フレームワーク: Express.js
- 認証: express-rate-limit + custom API Key middleware
- キャッシュ: Redis (Cloud Memorystore)
- ホスティング: Cloud Run (既存)
- ドメイン: api.ttkit.apti.jp
```

**メリット:**
- 既存コードベースを活用
- デプロイフロー確立済み
- チーム知見あり

**デメリット:**
- 既存バックエンドとの分離が不完全
- スケーリングが既存インフラに依存

---

#### Option B: 独立 API Gateway
```
- Gateway: Google Cloud API Gateway / Kong / Tyk
- Backend: 既存 Cloud Run（内部通信）
- 認証: API Gateway 管理
- レート制限: API Gateway 管理
- キャッシュ: Cloud CDN
```

**メリット:**
- 既存バックエンドと完全分離
- 高度なレート制限・認証機能
- 自動スケーリング

**デメリット:**
- 追加インフラコスト
- 設定・運用の複雑化

---

#### 推奨: Option A（既存バックエンド拡張）

**理由:**
1. 迅速な MVP リリース（1-2週間）
2. 既存インフラを活用してコスト最小化
3. 将来的に API Gateway 移行も可能

**実装案:**
```
/backend
  /src
    /routes
      /api
        /v1
          /adstxt.ts       # Public API
          /sellers.ts      # Public API
          /auth.ts         # API Key validation middleware
    /middleware
      /rate-limiter.ts     # Rate limiting
      /api-key-auth.ts     # API Key authentication
      /error-handler.ts    # Error response formatting
    /services
      /api-key-service.ts  # API Key CRUD
      /cache-service.ts    # Redis cache wrapper
```

---

### 11. API Key 管理テーブル設計

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash
  key_prefix VARCHAR(8) NOT NULL,        -- First 8 chars for display (e.g., "ttkit_ab")
  name VARCHAR(255) NOT NULL,            -- Key name (e.g., "Production Key - APTI")
  email VARCHAR(255) NOT NULL,           -- Owner email
  organization VARCHAR(255),             -- Organization name
  tier VARCHAR(50) DEFAULT 'free',       -- free, standard, enterprise
  rate_limit_day INTEGER DEFAULT 100,
  rate_limit_minute INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,                  -- Optional expiration
  metadata JSONB                         -- Additional data (IP whitelist, etc.)
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_email ON api_keys(email);

CREATE TABLE api_usage_logs (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_usage_logs_api_key_id ON api_usage_logs(api_key_id);
CREATE INDEX idx_api_usage_logs_timestamp ON api_usage_logs(timestamp);
```

---

### 12. セキュリティチェックリスト

#### 実装前
- [ ] API Key 生成方法の決定（crypto.randomBytes(32)）
- [ ] ハッシュ化アルゴリズムの選定（SHA-256 + Salt）
- [ ] レート制限ストレージの選定（Redis vs メモリ）
- [ ] CORS 許可ドメインリストの準備

#### 実装中
- [ ] SQL パラメータ化クエリの徹底
- [ ] 入力バリデーション（domain, seller_id, etc.）
- [ ] エラーメッセージの情報漏洩防止
- [ ] ロギングでの機密情報マスキング（API Key は key_hash のみ）

#### デプロイ前
- [ ] HTTPS 強制の確認
- [ ] 本番環境での API Key テスト
- [ ] レート制限の動作確認
- [ ] エラーハンドリングのテスト
- [ ] ログが正しく記録されているか確認

#### 運用開始後
- [ ] 定期的なセキュリティ監査
- [ ] API Key の不正使用パターン検出
- [ ] レート制限閾値の調整
- [ ] アクセスログの定期レビュー

---

### 13. よくある質問（FAQ）

**Q1: API Key はどこで取得できますか？**
A: 現在、API Key は APTI 承認後に手動発行します。将来的にはセルフサービスポータルを提供予定です。

**Q2: レート制限を超えた場合はどうなりますか？**
A: HTTP 429 エラーが返され、`Retry-After` ヘッダーで再試行までの秒数が通知されます。

**Q3: データの更新頻度は？**
A: ads.txt は毎日スキャン、sellers.json は週次更新です。API はキャッシュされたデータを返します。

**Q4: 過去のスキャン履歴は取得できますか？**
A: 現在は最新データのみ提供。履歴データは Enterprise プラン向けに検討中です。

**Q5: バッチ処理の上限は？**
A: 1回のバッチで最大 100 ドメインです。それ以上は複数リクエストに分割してください。

---

### 14. 参考資料

- [OpenAPI Specification 3.0](https://spec.openapis.org/oas/v3.0.0)
- [REST API Best Practices](https://restfulapi.net/)
- [API Security Checklist](https://github.com/shieldfy/API-Security-Checklist)
- [Google Cloud API Gateway](https://cloud.google.com/api-gateway/docs)
- [Express Rate Limit](https://github.com/express-rate-limit/express-rate-limit)

---

## 次のステップ

1. **レビュー**: この要求仕様を APTI チームでレビュー
2. **技術選定**: Option A (既存拡張) vs Option B (API Gateway) の決定
3. **Phase 1 実装**: MVP の開発開始（1-2週間）
4. **ベータテスト**: 限定的な API Key 発行でテスト運用
5. **本番リリース**: ドキュメント公開 + 一般提供開始

---

**作成日**: 2026-03-27  
**バージョン**: 1.0  
**作成者**: Claw (OpenClaw AI Assistant)  
**レビュー**: 未
