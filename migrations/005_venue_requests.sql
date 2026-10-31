CREATE TABLE IF NOT EXISTS venue_request (
  id uuid PRIMARY KEY,
  schedule_version_id uuid NOT NULL REFERENCES schedule_version(id) ON DELETE CASCADE,
  title text NOT NULL,
  requested_category text NOT NULL,
  draft jsonb NOT NULL,
  proposed_decision jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected', 'alternative_offered')),
  requested_by uuid NOT NULL REFERENCES app_user(id),
  reviewed_by uuid REFERENCES app_user(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS venue_request_review_idx
  ON venue_request (status, created_at);
