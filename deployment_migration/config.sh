#!/bin/bash

# ============================
# Configuration for Deployment
# ============================

export REGION="asia-northeast1"

# --- Project IDs ---
export PROJECT_ID="${PROJECT_ID:-apti-ttkit}"

# --- Resource Names ---
export REPO_NAME="ttkit-repo"
export BACKEND_SERVICE="ttkit-backend"
export FRONTEND_SERVICE="ttkit-frontend"
export DB_INSTANCE="ttkit-db-instance"
export SCHEDULER_JOB="ttkit-scan-job"

# --- Database Setup Config ---
export DB_NAME="ttkit_db"
export DB_USER="postgres"
