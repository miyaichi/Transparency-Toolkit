# Ads.txt Manager V2 🚀

**The Next-Gen Ads.txt & Sellers.json Management Platform**

Ads.txt Manager V2 is a performance-optimized toolkit for Publisher Operations and AdTech developers. It provides a unified interface to validate, optimize, and monitor supply chain standards (ads.txt, app-ads.txt, sellers.json).

## Key Features

### 🔍 Domain Search Validator & Explorer
- **Unified Validation**: Validate `ads.txt`, `app-ads.txt`, and `sellers.json` instantly for any domain.
- **Sellers Explorer**: High-performance search interface over **1 million+** global seller records indexed in PostgreSQL.
- **Cross-Check**: Verify if `ads.txt` relationships match `sellers.json` declarations (DIRECT/RESELLER checks).

### 🛠️ Ads.txt Optimizer
A step-by-step wizard to clean and fix ads.txt files:
1.  **Format Fixes**: Remove duplicates, invalid syntax, and formatting errors.
2.  **Relationship Correction**: Automatically correct `DIRECT` vs `RESELLER` based on sellers.json data.
3.  **Owner Domain**: Ensure correct `OWNERDOMAIN` declaration.
4.  **Verification**: Filter out lines that don't exist in the SSP's sellers.json.

### 📊 Monitoring & Analytics
- **Continuous Monitoring**: Track ads.txt changes over time for specific domains.
- **Sellers Discovery**: Automatically discover and fetch new sellers.json files from monitored publisher supply chains.
- **Insite Analytics**: View publisher reputation and supply path insights (powered by OpenSincera API).

### 🌍 Internationalization
- Fully localized for **English** and **Japanese**.

## Architecture

Performance is at the core of V2. It utilizes streaming ingestion for large datasets and efficient indexing.

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

## Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js v20+

### 1. Start Infrastructure
```bash
docker compose up -d
```
This starts PostgreSQL (port 5433) and the Backend API (port 8080).

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Access the application at [http://localhost:3000](http://localhost:3000).

### 3. Backend Setup (Optional for dev)
If you want to run the backend locally instead of via Docker:
```bash
cd backend
npm install
# Set env vars and run
DATABASE_URL=postgres://postgres:password@localhost:5433/adstxt_v2 PORT=8080 OPENSINCERA_API_KEY=your_key npm run dev
```

## Deployment

The project is designed to be deployed on **Google Cloud Run** and **Cloud SQL**.
See [DEPLOYMENT_GCP.md](./DEPLOYMENT_GCP.md) for detailed instructions.

- **CI/CD**: GitHub Actions workflows are set up for automated deployment. See [CICD_SETUP.md](./CICD_SETUP.md).

## Project Status

Current Phase: **🧪 Private Beta**
See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for detailed roadmap and changelog.

## License

Private / Proprietary.
