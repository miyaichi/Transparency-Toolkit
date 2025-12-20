# authentication-development-plan.md

## 1. プロジェクト概要
企業単位での契約をベースとした、ドメイン認証型のWebサービス認証システム。
ユーザーの利便性向上（SSO）と、管理コストの最小化（ユーザー情報の非保持）を両立させる。

## 2. 認証要件
* **ドメイン制限:** 契約企業のドメインのみアクセス許可。
* **IDP連携:** Google / Azure (Microsoft) を利用している企業はSSO。
* **パスワードレス:** SSO未導入企業には、メールによる認証コード/マジックリンク認証を提供。
* **ステートレス:** ユーザープロフィールはメールアドレスのみ保持し、パーソナライズは行わない。
* **即時停止:** 契約終了したドメイン、または退職によるメールアカウント失効時にアクセス権を喪失させる。

## 3. 技術スタック
* **Runtime:** Node.js v20+ / TypeScript
* **Infrastructure:** Google Cloud Run (Docker / Docker Compose)
* **Auth Platform:** Firebase Authentication (Identity Platform)
* **Database:** Firestore (契約ドメイン管理用)

## 4. 認証フロー図


1. **Email入力:** ユーザーがメールアドレスを入力。
2. **ドメイン判定:** システムが契約済みドメインかチェック。
3. **認証分岐:**
   - 連携済みSSO（Google/Azure）がある場合はそちらへリダイレクト。
   - ない場合は、入力されたアドレスへOTP（ワンタイムパスワード）またはリンクを送信。
4. **トークン発行:** 認証成功後、バックエンドでドメインの有効性を再検証し、セッションを開始。

## 5. 実装フェーズ

### Phase 1: データ設計 (Firestore)
* **ContractDomains (Collection):**
    * `domain`: string (Primary Key, 例: "example.com")
    * `companyName`: string
    * `status`: "active" | "suspended"
* **Users (Collection):**
    * `uid`: string (Firebase UID)
    * `email`: string
    * `lastAuthenticatedAt`: timestamp

### Phase 2: バックエンド実装 (Node.js/TS)
1. **Firebase Admin SDK の初期化:** Cloud Run 環境変数からサービスアカウントを読み込み。
2. **Domain Verification Middleware:** 全てのAPIリクエストに対し、Firebase ID Tokenを検証し、ドメインが `active` であるかを確認。
3. **SSO Config:** Identity Platform にて Google / Microsoft (Azure AD) のプロバイダを設定。

### Phase 3: コンテナ化とデプロイ
1. **Dockerfile:** `node:20-slim` を使用したマルチステージビルド。
2. **Cloud Run:** セキュリティのため、認証トークンは `HttpOnly` Cookie での運用を推奨。

## 6. セキュリティと運用上の考慮事項
* **即時性の担保:** 契約終了時に `ContractDomains` のステータスを変更するだけで、該当ドメインの全ユーザーが次のリクエストから拒否される仕組みとする。
* **セッション管理:** セッションの有効期限を短めに設定し、定期的にメールアドレスの有効性（＝在職確認）を担保する。
* **例外排除:** `gmail.com` などのフリードメインは登録できないようバリデーションを徹底する。
