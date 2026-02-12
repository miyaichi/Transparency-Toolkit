#!/bin/bash

# Load configuration
# Load configuration
SCRIPT_DIR=$(dirname "$0")
source "${SCRIPT_DIR}/config.sh"

if [[ "$PROJECT_ID" == "your-project-id" ]]; then
  echo "ERROR: Please set PROJECT_ID in config.sh or export it before running this script."
  exit 1
fi

echo "========================================================"
echo "Starting Initial Setup for Project: $PROJECT_ID"
echo "Region: $REGION"
echo "========================================================"

# Confirmation
read -p "Are you sure you want to setup resources in $PROJECT_ID? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

echo "Setting project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

# 1. Enable APIs
echo "1. Enabling required Google Cloud APIs..."
gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    artifactregistry.googleapis.com \
    compute.googleapis.com \
    cloudscheduler.googleapis.com

# 2. Create Artifact Registry
echo "2. Creating Artifact Registry: $REPO_NAME..."
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" >/dev/null 2>&1; then
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Docker repository for Transparency Toolkit"
else
    echo "Artifact Registry $REPO_NAME already exists."
fi

# 3. Create Cloud SQL Instance
echo "3. Creating Cloud SQL Instance: $DB_INSTANCE..."
echo "Enter password for DB user '$DB_USER' (input will be hidden):"
read -s DB_PASSWORD
echo

if ! gcloud sql instances describe "$DB_INSTANCE" >/dev/null 2>&1; then
    gcloud sql instances create "$DB_INSTANCE" \
        --database-version=POSTGRES_16 \
        --tier=db-g1-small \
        --region="$REGION" \
        --root-password="$DB_PASSWORD"
else
    echo "Instance $DB_INSTANCE already exists. Updating root password..."
    gcloud sql users set-password postgres --instance="$DB_INSTANCE" --password="$DB_PASSWORD"
fi

# 4. Create Database
echo "4. Creating Database: $DB_NAME..."
if ! gcloud sql databases describe "$DB_NAME" --instance="$DB_INSTANCE" >/dev/null 2>&1; then
    gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
else
    echo "Database $DB_NAME already exists."
fi

# 5. Service Account for GitHub Actions
SA_NAME="github-action-deployer"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
echo "5. Creating Service Account for GitHub Actions: $SA_NAME..."

if ! gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="GitHub Actions Deployer"
fi

echo "Assigning roles..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/run.admin" >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/artifactregistry.writer" >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/cloudsql.client" >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/iam.serviceAccountUser" >/dev/null

# Grant Cloud Run Invoker role to default compute service account for Cloud Scheduler
echo "Granting Cloud Run Invoker role for Cloud Scheduler..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$COMPUTE_SA" --role="roles/run.invoker" >/dev/null

echo "Generating Key File..."
KEY_FILE="gcp-key-$PROJECT_ID.json"
if [ -f "$KEY_FILE" ]; then
    echo "Key file $KEY_FILE already exists. Skipping generation."
else
    gcloud iam service-accounts keys create "$KEY_FILE" --iam-account="$SA_EMAIL"
    echo "Key file generated: $KEY_FILE"
fi

# 6. Create Cloud Scheduler Job
echo "6. Creating Cloud Scheduler Job: $SCHEDULER_JOB..."
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null)
if [ -n "$BACKEND_URL" ]; then
    if ! gcloud scheduler jobs describe "$SCHEDULER_JOB" --location="$REGION" >/dev/null 2>&1; then
        gcloud scheduler jobs create http "$SCHEDULER_JOB" \
            --location="$REGION" \
            --schedule="0 */6 * * *" \
            --uri="$BACKEND_URL/api/jobs/scan" \
            --http-method=POST \
            --attempt-deadline=600s \
            --oidc-service-account-email="$COMPUTE_SA"
    else
        echo "Scheduler job $SCHEDULER_JOB already exists. Updating configuration..."
        gcloud scheduler jobs update http "$SCHEDULER_JOB" \
            --location="$REGION" \
            --schedule="0 */6 * * *" \
            --uri="$BACKEND_URL/api/jobs/scan" \
            --http-method=POST \
            --attempt-deadline=600s \
            --oidc-service-account-email="$COMPUTE_SA"
    fi
else
    echo "WARNING: Backend service not yet deployed. Skipping Cloud Scheduler Job creation."
    echo "After deploying the backend, create the scheduler job manually:"
    echo "  gcloud scheduler jobs create http $SCHEDULER_JOB \\"
    echo "    --location=$REGION \\"
    echo "    --schedule='0 */6 * * *' \\"
    echo "    --uri=<BACKEND_URL>/api/jobs/scan \\"
    echo "    --http-method=POST \\"
    echo "    --attempt-deadline=600s \\"
    echo "    --oidc-service-account-email=$COMPUTE_SA"
fi

# 7. Database Initialization Info
echo "========================================================"
echo "SETUP COMPLETE!"
echo "========================================================"
echo "Next Steps:"
echo "1. Initialize the database schema:"
echo "   Run the following command locally (requires cloud-sql-proxy installed):"
echo "   ./cloud-sql-proxy $PROJECT_ID:$REGION:$DB_INSTANCE --port 5434 &"
echo "   psql \"host=127.0.0.1 port=5434 sslmode=disable dbname=$DB_NAME user=$DB_USER password=\$DB_PASSWORD\" -f ../backend/src/db/init.sql"
echo ""
echo "2. Updates required for GitHub Actions:"
echo "   - Go to your GitHub Repository > Settings > Secrets and variables > Actions"
echo "   - Add/Update 'GCP_CREDENTIALS' with the content of $KEY_FILE"
echo "   - Add/Update 'DB_PASSWORD' with the password you set."
echo "   - Add/Update 'DB_NAME' to '$DB_NAME'"
echo "   - Copy deploy.yml to .github/workflows/:"
echo "     cp deploy.yml ../.github/workflows/deploy-gcp.yml"
echo ""
