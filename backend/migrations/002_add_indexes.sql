-- Composite index for moderation queue (filters by status, orders by occurred_at DESC + id DESC)
CREATE INDEX IF NOT EXISTS incidents_status_occurred_at_id_idx
  ON incidents (verification_status, occurred_at DESC, id DESC);

-- Indexes on dedup_candidates FK columns (Postgres does not auto-create these)
CREATE INDEX IF NOT EXISTS dedup_candidates_source_id_idx
  ON dedup_candidates (source_id);

CREATE INDEX IF NOT EXISTS dedup_candidates_candidate_incident_id_idx
  ON dedup_candidates (candidate_incident_id);
