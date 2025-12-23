#!/bin/bash

# Load configuration
source ./config.sh

echo "========================================================"
echo "WARNING: YOU ARE ABOUT TO DELETE RESOURCES IN PROJECT: $OLD_PROJECT_ID"
echo "Resources to be deleted:"
echo " - Cloud Run Services: $BACKEND_SERVICE, $FRONTEND_SERVICE"
echo " - Artifact Registry: $REPO_NAME"
echo " - Cloud SQL Instance: $DB_INSTANCE"
echo " - Cloud Scheduler Job: $SCHEDULER_JOB"
echo "========================================================"
echo "Press CTRL+C to cancel within 5 seconds..."
sleep 5

echo "Setting project to $OLD_PROJECT_ID..."
gcloud config set project "$OLD_PROJECT_ID"

echo "1. Deleting Cloud Scheduler Job..."
gcloud scheduler jobs delete "$SCHEDULER_JOB" --location="$REGION" --quiet || echo "Job not found or already deleted."

echo "2. Deleting Cloud Run Services..."
gcloud run services delete "$BACKEND_SERVICE" --region="$REGION" --quiet || echo "Backend service not found."
gcloud run services delete "$FRONTEND_SERVICE" --region="$REGION" --quiet || echo "Frontend service not found."

echo "3. Deleting Artifact Registry..."
gcloud artifacts repositories delete "$REPO_NAME" --location="$REGION" --quiet || echo "Repository not found."

echo "4. Deleting Cloud SQL Instance..."
# This takes a while
gcloud sql instances delete "$DB_INSTANCE" --quiet || echo "Instance not found."

echo "Teardown complete for project $OLD_PROJECT_ID."
