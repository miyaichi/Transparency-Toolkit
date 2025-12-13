# Ads.txt Manager V2

Performance-optimized backend for Ads.txt and Sellers.json processing using Node.js Streams and PostgreSQL.

## Prerequisites

- Docker Engine & Docker Compose
- Node.js v20+

## Setup

1. Start the database and backend container:
   ```bash
   docker compose up -d
   ```

2. Install dependencies (on host):
   ```bash
   cd backend
   npm install
   ```

## Running Ingestion PoC

Run the streaming ingestion script to fetch Google's sellers.json and insert it into the database:

```bash
cd backend
npm run ingest
```

## Performance Benchmark

- **Target**: `google.com/sellers.json` (~1M+ records)
- **Time**: ~35 seconds
- **Memory Usage**: Minimal (Streaming)

## Database Schema

- `raw_sellers_files`: Metadata of fetched files.
- `sellers_catalog`: Normalized sellers data for search.

## Architecture Diagram

```mermaid
graph TD
    User[User / Frontend] -->|API Request| API[Hono API Server]
    API -->|Validation/Scan| Scanner[AdsTxtScanner Service]
    API -->|Query| DB[(PostgreSQL)]
    
    Scheduler[Cron Scheduler] -->|Trigger| Scanner
    Scheduler -->|Trigger| Importer[StreamImporter Service]
    
    Scanner -->|Fetch ads.txt| External[External Domains]
    Importer -->|Fetch sellers.json Stream| External
    
    Scanner -->|Save Result| DB
    Importer -->|Bulk Insert COPY| DB
    
    subgraph "Google Cloud Platform"
        API
        Scanner
        Scheduler
        Importer
        DB
    end
```

### Domain Search Validator
The V2 frontend features a unified "Domain Search Validator". By entering a domain name (e.g., `nytimes.com`), users can instantly validate and inspect:
- **Ads.txt**: Publisher's authorized digital sellers.
- **App-ads.txt**: Mobile app developer's authorized sellers.
- **Sellers.json**: SSP/Exchange's seller inventory (SupplyChain).

The results are displayed in separate tabs with validation status, stats, and downloadable CSV reports.


## Checking Data

```bash
docker exec -it adstxt-v2-db psql -U postgres -d adstxt_v2 -c "SELECT count(*) FROM sellers_catalog;"
```

## Running the Application

### Backend API & Scheduler

Starts the API server (default port 3001) and the Cron Scheduler (runs every minute).

```bash
cd backend
npm run build
npm start
```

### Frontend UI

Starts the Next.js frontend (default port 3000).

```bash
cd frontend
npm install
npm run dev
```

## Features

- **Sellers Search**: Performant search over 1M+ seller records.
- **Ads.txt Validator**: Fetch, parse, and cross-check ads.txt files against sellers.json.
- **Scan History**: View historical scans and their results.
- **Monitoring**: Schedule periodic ads.txt scans for specific domains.
  - Manage monitored domains via the "Monitor" UI or API.
  - Automatically fetches updated sellers.json for supply sources found in scanned ads.txt.
