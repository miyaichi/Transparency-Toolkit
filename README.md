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

## Checking Data

```bash
docker exec -it adstxt-v2-db psql -U postgres -d adstxt_v2 -c "SELECT count(*) FROM sellers_catalog;"
```
