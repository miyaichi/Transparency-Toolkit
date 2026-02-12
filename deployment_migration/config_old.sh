#!/bin/bash

# ==========================================
# Configuration for Deployment Migration
# ==========================================

export REGION="asia-northeast1"

# --- Project IDs ---
# OLD: The project to tear down
export OLD_PROJECT_ID="${OLD_PROJECT_ID:-adstxt-manager-v2}"

# NEW: The project to setup (Set this manually or check readme)
export NEW_PROJECT_ID="${NEW_PROJECT_ID:-your-new-project-id}"

# --- Common Resource Names ---
# These names will be used for both teardown (old) and setup (new)
export REPO_NAME="adstxt-repo"
export BACKEND_SERVICE="adstxt-backend"
export FRONTEND_SERVICE="adstxt-frontend"
export DB_INSTANCE="adstxt-db-instance"
export SCHEDULER_JOB="adstxt-scan-job"

# --- Database Setup Config ---
export DB_NAME="adstxt_v2"
export DB_USER="postgres"
