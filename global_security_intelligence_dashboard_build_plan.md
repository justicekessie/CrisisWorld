# Global Security Intelligence Dashboard Build Plan

## 1. MVP Scope (Build-Ready)

### 1.1 MVP Goal
Deliver a production-capable v1 that allows users to discover, filter, and investigate global security incidents on an interactive map with trusted source traceability.

### 1.2 In-Scope Features (MVP)
- Map-first dashboard with clustering and heatmap toggle
- Incident search and filtering by:
  - Country
  - Date range
  - Incident category
  - Verification level
  - Casualty range
- Incident detail drawer with:
  - Title, date/time, country, city, coordinates
  - Casualties (killed/injured)
  - Suspected actor/group (nullable)
  - Description and source links
  - Verification status/confidence label
- Basic trend panel:
  - Incidents over time
  - Fatalities over time
  - Top affected countries
- Ingestion pipeline from 2-3 sources (for launch):
  - ACLED (or comparable structured dataset)
  - GDELT or trusted news API
  - Curated RSS feeds
- AI-assisted features (limited MVP version):
  - Event entity extraction from article text
  - Source deduplication candidate matching
  - Short incident summary generation
- Moderation and trust:
  - Admin queue for pending records
  - Confidence levels 1-5
  - Basic duplicate flagging
- Authentication and roles:
  - Public read-only dashboard
  - Admin/moderator role for review actions

### 1.3 Out of Scope (Post-MVP)
- Full public upload workflow with media moderation at global scale
- Advanced forecasting models and long-horizon risk prediction
- Real-time websocket feeds from many providers
- Multi-tenant enterprise controls and SSO
- Native mobile apps

### 1.4 MVP Quality Bar
- P95 map interaction response under 500 ms for filtered view actions
- Ingestion jobs with retry and dead-letter handling
- Every incident traceable to at least one stored source record
- Audit log for all moderator decisions
- Role-based access enforced on admin endpoints

---

## 2. Phased Roadmap

## Phase 0: Foundation (Week 1-2)
- Create monorepo structure (web, api, workers)
- Provision Postgres + PostGIS, Redis, object storage
- Set up CI, linting, type checks, migration workflow
- Implement base auth and role model

Exit criteria:
- Environments boot reliably
- First DB migration and seed data succeed
- CI runs tests and build on push

## Phase 1: Core Intelligence Dashboard (Week 3-6)
- Build map UI with clustering, filters, and drawer
- Build incident APIs and query performance indexes
- Add trend analytics endpoints and charts
- Implement source + incident data model and ETL job

Exit criteria:
- User can filter and inspect incidents globally
- Dashboard renders trends from real ingested data
- Query latency meets target under expected dataset size

## Phase 2: AI + Moderation (Week 7-9)
- Add extraction service for article to structured fields
- Add deduplication scoring and merge suggestions
- Add AI summaries for incident cards and daily brief
- Build moderator queue and verification workflows

Exit criteria:
- New ingestion creates extraction output automatically
- Moderators can approve/reject/merge with audit trail
- Duplicate rate reduced versus baseline

## Phase 3: Public Reporting + Trust Expansion (Week 10-12)
- Launch controlled public submission form
- Add media upload + safety checks (type, size, malware scan)
- Add image moderation and queue triage
- Add source credibility scoring baseline

Exit criteria:
- Public submissions enter review queue safely
- Harmful/spam content detection blocks obvious abuse
- Confidence labels consistently applied

## Phase 4: Scale and Intelligence Enhancements (Post-Launch)
- Near real-time stream processing
- Country and actor intelligence pages
- Alerting subscriptions and briefing exports
- Enterprise controls, SSO, and tenant policies

---

## 3. System Architecture (Practical Draft)

## 3.1 Components
- Web App (Next.js)
  - Map view, filters, analytics, incident drawer
- API Service (Node.js, TypeScript)
  - Query APIs, auth, moderation actions
- Ingestion Worker
  - Pull feeds/APIs, normalize, persist raw and canonical records
- AI Processing Worker
  - Extraction, dedup candidate generation, summarization
- Moderation Service (can begin inside API)
  - Review queue, decisioning, audit trail
- Data Layer
  - Postgres + PostGIS for canonical incident and geospatial queries
  - Redis for queueing, cache, rate-limiting helpers
  - Optional Elasticsearch for advanced full-text/search later
- Object Storage
  - Media and evidence files

## 3.2 Data Flow
1. Source fetcher collects raw items and stores them as source documents.
2. Normalizer maps source fields to canonical schema.
3. AI worker extracts entities and computes dedup candidates.
4. Dedup logic links source documents to existing incident or creates new incident.
5. Incident gets confidence score and verification status.
6. API serves filtered incident map and trend aggregations.
7. Moderator decisions update verification state and append audit log.

## 3.3 Suggested API Surface (v1)
- GET /api/incidents
- GET /api/incidents/:id
- GET /api/analytics/timeseries
- GET /api/analytics/top-countries
- GET /api/sources/:id
- GET /api/moderation/queue (admin)
- POST /api/moderation/incidents/:id/verify (admin)
- POST /api/moderation/incidents/:id/reject (admin)
- POST /api/moderation/incidents/:id/merge (admin)

## 3.4 Non-Functional Priorities
- Security:
  - Input validation, strict role checks, signed upload URLs
- Reliability:
  - Idempotent ingestion jobs and replay support
- Observability:
  - Structured logs, job metrics, endpoint latency dashboards
- Compliance:
  - Data retention policy and source attribution requirements

---

## 4. Initial Database Schema Draft

## 4.1 Core Tables

### incidents
- id (uuid, pk)
- title (text, not null)
- description (text)
- occurred_at (timestamptz, not null)
- country_code (char(2), not null)
- country_name (text, not null)
- region_name (text)
- city_name (text)
- location (geography(Point, 4326), not null)
- incident_category (text, not null)
- attack_type (text)
- target_type (text)
- suspected_group_id (uuid, fk nullable)
- killed_count (int default 0)
- injured_count (int default 0)
- confidence_level (smallint not null check 1-5)
- verification_status (text not null)  -- pending, verified, rejected
- risk_score (numeric(5,2))
- ai_summary (text)
- created_at (timestamptz not null default now())
- updated_at (timestamptz not null default now())

Indexes:
- gist(location)
- btree(occurred_at desc)
- btree(country_code, occurred_at desc)
- btree(verification_status)

### groups
- id (uuid, pk)
- name (text, unique, not null)
- ideology (text)
- aliases (text[])
- active_regions (text[])
- created_at (timestamptz)

### sources
- id (uuid, pk)
- provider (text, not null)
- source_type (text, not null) -- official, media, ngo, community
- title (text)
- url (text)
- published_at (timestamptz)
- raw_payload (jsonb, not null)
- content_hash (text, unique)
- credibility_score (numeric(4,2))
- ingested_at (timestamptz not null default now())

### incident_sources
- incident_id (uuid, fk incidents)
- source_id (uuid, fk sources)
- relevance_score (numeric(4,3))
- extraction_model (text)
- extraction_version (text)
- primary key (incident_id, source_id)

### dedup_candidates
- id (uuid, pk)
- source_id (uuid, fk sources, not null)
- candidate_incident_id (uuid, fk incidents, not null)
- similarity_score (numeric(4,3), not null)
- decision_status (text not null) -- pending, accepted, rejected
- reviewed_by (uuid, fk users nullable)
- reviewed_at (timestamptz)

### submissions
- id (uuid, pk)
- submitted_by (uuid, fk users nullable)
- description (text)
- location (geography(Point, 4326))
- media_urls (text[])
- status (text not null) -- pending, approved, rejected
- ai_extraction (jsonb)
- created_at (timestamptz default now())

### moderation_actions
- id (uuid, pk)
- moderator_id (uuid, fk users, not null)
- target_type (text, not null) -- incident, source, submission
- target_id (uuid, not null)
- action_type (text, not null) -- verify, reject, merge, edit
- reason (text)
- metadata (jsonb)
- created_at (timestamptz not null default now())

### users
- id (uuid, pk)
- email (text, unique, not null)
- role (text not null) -- viewer, moderator, admin
- created_at (timestamptz not null default now())

## 4.2 Example Query Shapes
- Map bounding-box query using geospatial filter + date window
- Country trend aggregation grouped by day/week
- Top groups by incident count and casualty totals
- Related incidents within radius and time threshold

---

## 5. Execution Notes
- Start with Postgres-only search plus trigram indexes; introduce Elasticsearch only when required by load or relevance demands.
- Keep ingestion records immutable and append canonical updates through controlled merge operations.
- Version AI prompts/models in stored metadata to maintain explainability.
- Build trust UX early: always show source count and confidence label near incident title.

## 6. Immediate Next Build Tasks
1. Generate SQL migrations for core tables and indexes.
2. Scaffold API endpoints for incident listing, detail, and timeseries analytics.
3. Implement one source connector and canonical normalizer.
4. Deliver map UI with filter sidebar and incident drawer.
5. Add moderator queue with verify/reject actions and audit log entries.
