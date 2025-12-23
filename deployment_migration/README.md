# Deployment Migration Toolkit

This directory contains scripts to help migrate the Ads.txt Manager V2 application to a new Google Cloud Project for the public beta.

## Files

- `config.sh`: Configuration file defining resource names and Project IDs.
- `teardown_old_env.sh`: Script to delete resources in the old environment/project.
- `setup_new_env.sh`: Script to initialize resources in the new environment/project.
- `deploy-beta.yml`: A GitHub Actions workflow template for the new environment.

## Usage Guide

### 1. Configuration

Open `config.sh` and ensure the settings are correct.

- **OLD_PROJECT_ID**: The ID of the project you are migrating _away from_ (resources here will be deleted).
- **NEW_PROJECT_ID**: The ID of the project you are migrating _to_. You must set this or export it as an environment variable.

### 2. Teardown Old Infrastructure

**WARNING**: This will permanently delete resources in the old project.

```bash
./teardown_old_env.sh
```

### 3. Setup New Environment

Run the setup script to enable APIs, create the Artifact Registry, Cloud SQL, and Service Account.

```bash
# Export your new project ID first if not set in config.sh
export NEW_PROJECT_ID="your-new-real-project-id"
./setup_new_env.sh
```

Follow the on-screen instructions. The script will generate a `gcp-key-....json` file.

### 4. Database Initialization

After the setup script finishes, it will give you commands to initialize the database schema.
You will need `cloud-sql-proxy` installed or use Cloud Shell.

Example:

```bash
./cloud-sql-proxy adstxt-db-instance --port 5434 &
psql "host=127.0.0.1 port=5434 sslmode=disable dbname=adstxt_v2 user=postgres password=YOUR_PASSWORD" -f ../backend/src/db/init.sql
```

### 5. Configure GitHub Actions

1. Copy `deploy-beta.yml` to your workflows directory:

   ```bash
   cp deploy-beta.yml ../.github/workflows/deploy-gcp.yml
   ```

   (Or keep both if you want to maintain multiple environments).

2. Edit `.github/workflows/deploy-gcp.yml` (or `deploy-beta.yml`) and update `PROJECT_ID` to your new project ID.

3. Go to GitHub Repository Settings > Secrets > Actions and add/update:
   - `GCP_CREDENTIALS`: Paste the content of the generated JSON key file.
   - `DB_PASSWORD`: The database password you set during setup.
   - `DB_NAME`: `adstxt_v2` (or whatever you configured).
   - Ensure `GEMINI_API_KEY`, `OPENSINCERA_API_KEY`, `SENTRY_DSN`, etc., are also set if they haven't changed.

## Notes

- The scripts assume you have `gcloud` installed and authenticated (`gcloud auth login`).
- Make sure you are an Editor or Owner on the new GCP project.
