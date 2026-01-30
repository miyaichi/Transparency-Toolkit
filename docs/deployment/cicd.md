# CI/CD 設定手順

GitHub Actionsを利用して、mainブランチへのPush時に自動デプロイを行います。

## 1. サービスアカウントの作成とキーの発行
GCPコンソールまたはCLIで、GitHub Actions用のサービスアカウントを作成し、必要な権限を付与します。

```bash
# サービスアカウント作成
gcloud iam service-accounts create github-actions-deploy --display-name='GitHub Actions Deploy'

# 権限付与 (Artifact Registry, Cloud Run, Cloud SQL Client)
gcloud projects add-iam-policy-binding adstxt-manager-v2     --member='serviceAccount:github-actions-deploy@adstxt-manager-v2.iam.gserviceaccount.com'     --role='roles/editor' 
    # 本番運用時は roles/run.admin, roles/artifactregistry.writer など最小権限に絞ることを推奨

# キーの発行 (JSONファイルがダウンロードされます)
gcloud iam service-accounts keys create gcp-key.json --iam-account=github-actions-deploy@adstxt-manager-v2.iam.gserviceaccount.com
```

## 2. GitHub Secrets の設定
GitHubリポジトリの Settings > Secrets and variables > Actions に以下のSecretを追加します。

| Name | Value |
| :--- | :--- |
| `GCP_CREDENTIALS` | ダウンロードした `gcp-key.json` の中身すべて |
| `DB_PASSWORD` | Cloud SQLのパスワード (`adstxt-db-password-123`) |
| `DB_NAME` | データベース名 (`adstxt_v2`) |
| `OPENSINCERA_API_KEY` | OpenSincera APIのキー |

## 3. 動作確認
設定後、mainブランチに変更をPushすると `Deploy to Cloud Run` ワークフローが実行されます。

