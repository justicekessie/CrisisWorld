# CrisisWorld Backend Scaffold

This folder contains the initial API and migration scaffold for the Global Security Intelligence Dashboard MVP.

## Endpoints
- GET /health
- GET /api/incidents
- GET /api/incidents/:id
- GET /api/analytics/timeseries
- GET /api/analytics/top-countries
- GET /api/moderation/queue
- POST /api/moderation/incidents/:id/verify
- POST /api/moderation/incidents/:id/reject
- POST /api/moderation/incidents/merge

## Quick Start
1. Copy .env.example to .env and set DATABASE_URL.
2. Install dependencies.
3. Run database migrations.
4. Seed sample data (optional but recommended for local testing).
5. Run RSS ingestion (optional) to pull latest feed items.
6. Import local CSV incidents (optional).
7. Run the API.

```bash
npm install
npm run migrate
npm run seed
npm run ingest:rss
npm run import:csv
npm run dev
```

## Notes
- Query params for /api/incidents: countryCode, verificationStatus, category, dateFrom, dateTo, limit
- Query params for /api/analytics/timeseries: countryCode, dateFrom, dateTo
- Query params for /api/moderation/queue: status, limit, cursorOccurredAt, cursorId
- `ingest:rss` writes normalized source entries to `sources` and links/incubates incidents in `incidents`
- `import:csv` loads incidents from `../-338405971 - -338405971.csv` by default (override with `CSV_IMPORT_PATH`)
- Moderation endpoints require headers: `x-user-role: moderator|admin` and `x-user-id: <uuid>`
- Verify/reject request body: `{ "reason": "optional note" }`
- Merge request body: `{ "sourceIncidentId": "<uuid>", "targetIncidentId": "<uuid>", "reason": "optional note" }`
