# Google Cloud Platform デプロイガイド (Cloud Run + Cloud SQL)

このガイドでは、Ads.txt Manager V2をGCP環境（Cloud Run, Cloud SQL）にデプロイする手順を説明します。

## 構成概要

- **Frontend**: Next.js (Cloud Run)
- **Backend**: Node.js/Hono (Cloud Run)
- **Database**: PostgreSQL (Cloud SQL)

## 前提条件

- Google Cloud SDK (`gcloud`) がインストール・認証済みであること
- GCPプロジェクトが作成済みであること
- Dockerがインストールされていること

## 1. 環境設定

プロジェクトIDなどの変数を設定します。

```bash
# プロジェクトIDを設定（自身のIDに書き換えてください）
export PROJECT_ID="your-project-id"
export REGION="asia-northeast1" # 東京リージョン

gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION
```

APIを有効化します。

```bash
gcloud services enable run.googleapis.com \
    sqladmin.googleapis.com \
    artifactregistry.googleapis.com \
    compute.googleapis.com
```

## 2. Cloud SQL (PostgreSQL) の構築

Cloud SQLインスタンスを作成します。

```bash
# インスタンス作成 (数分かかります)
gcloud sql instances create adstxt-db-instance \
    --database-version=POSTGRES_16 \
    --tier=db-f1-micro \
    --region=$REGION \
    --root-password="your-db-password" # 強力なパスワードに変更してください

# データベースの作成
gcloud sql databases create adstxt_v2 --instance=adstxt-db-instance
```

**重要**: 本番運用ではプライベートIP接続を推奨しますが、簡易セットアップとしてパブリックIP接続とCloud Run接続の設定を行います。

## 3. Artifact Registry の作成

Dockerイメージを格納するリポジトリを作成します。

```bash
gcloud artifacts repositories create adstxt-repo \
    --repository-format=docker \
    --location=$REGION
```

## 4. Backend のデプロイ

DockerイメージのビルドとPush:

```bash
cd backend

# イメージのビルド
docker build --platform linux/amd64 -t $REGION-docker.pkg.dev/$PROJECT_ID/adstxt-repo/backend:latest .

# イメージのPush (configure-dockerが必要な場合あり: gcloud auth configure-docker $REGION-docker.pkg.dev)
docker push $REGION-docker.pkg.dev/$PROJECT_ID/adstxt-repo/backend:latest

cd ..
```

Cloud Runへのデプロイ:

```bash
# DB接続用の接続名を取得
export DB_INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe adstxt-db-instance --format="value(connectionName)")
export OPENSINCERA_API_KEY="your-opensincera-api-key"

gcloud run deploy adstxt-backend \
    --image $REGION-docker.pkg.dev/$PROJECT_ID/adstxt-repo/backend:latest \
    --add-cloudsql-instances $DB_INSTANCE_CONNECTION_NAME \
    --set-env-vars DATABASE_URL="postgres://postgres:your-db-password@/${DB_INSTANCE_CONNECTION_NAME}?host=/cloudsql/${DB_INSTANCE_CONNECTION_NAME}",OPENSINCERA_API_KEY=$OPENSINCERA_API_KEY \
    --allow-unauthenticated
```

デプロイ完了後、BackendのURLが表示されます（`Service URL: https://adstxt-backend-xxxxx-an.a.run.app`）。これを控えておきます。
※初期化処理として、DBマイグレーションが必要な場合は、Cloud Run Jobを利用するか、一時的に接続してSQLを流す必要があります。今回は簡易的にローカルからの接続やCloud Shellからの接続で `backend/src/db/init.sql` を実行することを想定してください。

## 5. Frontend のデプロイ

```bash
cd frontend

# イメージのビルド
docker build --platform linux/amd64 -t $REGION-docker.pkg.dev/$PROJECT_ID/adstxt-repo/frontend:latest .

# イメージのPush
docker push $REGION-docker.pkg.dev/$PROJECT_ID/adstxt-repo/frontend:latest

cd ..
```

Cloud Runへのデプロイ（Backend URLを設定）:

```bash
# 先ほど取得したBackendのURLを設定 (末尾のスラッシュなし)
export BACKEND_URL="https://adstxt-backend-xxxxx-an.a.run.app"

gcloud run deploy adstxt-frontend \
    --image $REGION-docker.pkg.dev/$PROJECT_ID/adstxt-repo/frontend:latest \
    --set-env-vars BACKEND_URL=$BACKEND_URL \
    --allow-unauthenticated
```


## 6. DB初期化について (補足)

Cloud SQLへの初回テーブル作成は、Cloud SQL Auth Proxyなどを使ってローカルから接続して行うのが最も手軽です。

```bash
# Cloud SQL Auth Proxyのインストールと実行
./cloud-sql-proxy adstxt-db-instance --port 5434

# 別のターミナルで初期SQLを実行
psql "host=127.0.0.1 port=5434 sslmode=disable dbname=adstxt_v2 user=postgres password=your-db-password" -f backend/src/db/init.sql
```

## 7. 定期実行ジョブ (Cloud Scheduler) の設定

Cloud Run はリクエストがない時にアイドル状態となりバックグラウンド処理（node-cron等）が停止するため、Cloud Scheduler を使用して定期的にスキャン処理をトリガーします。

### バックグラウンドスキャンジョブの作成 (15分間隔)

```bash
# Cloud Scheduler APIの有効化
gcloud services enable cloudscheduler.googleapis.com

# Backend Service URLの取得 (未設定の場合)
export BACKEND_URL=$(gcloud run services describe adstxt-backend --format 'value(status.url)')

# ジョブの作成
gcloud scheduler jobs create http adstxt-scan-job \
  --location=$REGION \
  --schedule "*/15 * * * *" \
  --uri "${BACKEND_URL}/api/jobs/trigger" \
  --http-method POST \
  --time-zone "Asia/Tokyo" \
  --description "Trigger ads.txt background scan and sellers.json sync"
```

この設定により、Cloud Run インスタンスの状態に関わらず、確実に15分ごとにバックグラウンド処理が実行されます。

