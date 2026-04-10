CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer', 'moderator', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY,
  name text UNIQUE NOT NULL,
  ideology text,
  aliases text[],
  active_regions text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL,
  country_code char(2) NOT NULL,
  country_name text NOT NULL,
  region_name text,
  city_name text,
  location geography(Point, 4326) NOT NULL,
  incident_category text NOT NULL,
  attack_type text,
  target_type text,
  suspected_group_id uuid REFERENCES groups(id),
  killed_count int NOT NULL DEFAULT 0,
  injured_count int NOT NULL DEFAULT 0,
  confidence_level smallint NOT NULL CHECK (confidence_level BETWEEN 1 AND 5),
  verification_status text NOT NULL CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  risk_score numeric(5,2),
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_location_idx ON incidents USING GIST (location);
CREATE INDEX IF NOT EXISTS incidents_occurred_at_idx ON incidents (occurred_at DESC);
CREATE INDEX IF NOT EXISTS incidents_country_occurred_at_idx ON incidents (country_code, occurred_at DESC);
CREATE INDEX IF NOT EXISTS incidents_verification_status_idx ON incidents (verification_status);

CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY,
  provider text NOT NULL,
  source_type text NOT NULL,
  title text,
  url text,
  published_at timestamptz,
  raw_payload jsonb NOT NULL,
  content_hash text UNIQUE,
  credibility_score numeric(4,2),
  ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_sources (
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relevance_score numeric(4,3),
  extraction_model text,
  extraction_version text,
  PRIMARY KEY (incident_id, source_id)
);

CREATE TABLE IF NOT EXISTS dedup_candidates (
  id uuid PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  candidate_incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  similarity_score numeric(4,3) NOT NULL,
  decision_status text NOT NULL CHECK (decision_status IN ('pending', 'accepted', 'rejected')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY,
  submitted_by uuid REFERENCES users(id),
  description text,
  location geography(Point, 4326),
  media_urls text[],
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  ai_extraction jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id uuid PRIMARY KEY,
  moderator_id uuid NOT NULL REFERENCES users(id),
  target_type text NOT NULL CHECK (target_type IN ('incident', 'source', 'submission')),
  target_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('verify', 'reject', 'merge', 'edit')),
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
