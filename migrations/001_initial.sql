CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'department_coordinator', 'faculty', 'club');
CREATE TYPE schedule_status AS ENUM ('draft', 'generating', 'validated', 'pending_admin_approval', 'approved', 'rejected', 'failed');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'dead_lettered');

CREATE TABLE app_user (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role user_role NOT NULL,
  department text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dataset_version (
  id uuid PRIMARY KEY,
  dataset_id text NOT NULL,
  content_hash text NOT NULL,
  source_name text NOT NULL,
  payload jsonb NOT NULL,
  imported_by uuid REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, content_hash)
);

CREATE INDEX dataset_version_created_at_idx ON dataset_version (created_at DESC);
CREATE INDEX dataset_version_payload_gin_idx ON dataset_version USING gin (payload jsonb_path_ops);

CREATE TABLE schedule_version (
  id uuid PRIMARY KEY,
  dataset_version_id uuid NOT NULL REFERENCES dataset_version(id),
  baseline_schedule_id uuid REFERENCES schedule_version(id),
  status schedule_status NOT NULL DEFAULT 'draft',
  objective jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_report jsonb,
  disruption jsonb,
  created_by uuid REFERENCES app_user(id),
  approved_by uuid REFERENCES app_user(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX schedule_version_dataset_status_idx ON schedule_version (dataset_version_id, status, created_at DESC);
CREATE INDEX schedule_version_baseline_idx ON schedule_version (baseline_schedule_id) WHERE baseline_schedule_id IS NOT NULL;

CREATE TABLE schedule_session (
  schedule_version_id uuid NOT NULL REFERENCES schedule_version(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  day text NOT NULL,
  start_period smallint NOT NULL CHECK (start_period BETWEEN 1 AND 9),
  room_id text NOT NULL,
  PRIMARY KEY (schedule_version_id, session_id)
);

CREATE INDEX schedule_session_room_slot_idx ON schedule_session (schedule_version_id, room_id, day, start_period);
CREATE INDEX schedule_session_lookup_idx ON schedule_session (schedule_version_id, day, start_period, room_id);

CREATE TABLE booking_decision (
  id uuid PRIMARY KEY,
  schedule_version_id uuid NOT NULL REFERENCES schedule_version(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('approved', 'rejected', 'alternative_offered')),
  day text,
  start_period smallint,
  end_period smallint,
  room_id text,
  reason text NOT NULL,
  decided_by uuid REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_version_id, request_id)
);

CREATE INDEX booking_decision_status_idx ON booking_decision (schedule_version_id, status, created_at DESC);
CREATE INDEX booking_decision_room_slot_idx ON booking_decision (schedule_version_id, room_id, day, start_period) WHERE status <> 'rejected';

CREATE TABLE idempotency_record (
  actor_id uuid NOT NULL REFERENCES app_user(id),
  method text NOT NULL,
  route text NOT NULL,
  idempotency_key uuid NOT NULL,
  request_hash text NOT NULL,
  status_code integer,
  response_body jsonb,
  resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (actor_id, method, route, idempotency_key)
);

CREATE INDEX idempotency_expiry_idx ON idempotency_record (expires_at);

CREATE TABLE job (
  id uuid PRIMARY KEY,
  type text NOT NULL,
  priority smallint NOT NULL CHECK (priority BETWEEN 0 AND 3),
  status job_status NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL,
  result jsonb,
  error text,
  attempt_count integer NOT NULL DEFAULT 0,
  correlation_id uuid NOT NULL,
  idempotency_key uuid,
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_claim_idx ON job (status, priority, available_at, created_at) WHERE status = 'queued';
CREATE INDEX job_correlation_idx ON job (correlation_id, created_at DESC);
CREATE UNIQUE INDEX job_dedupe_idx ON job (type, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE outbox_event (
  id uuid PRIMARY KEY,
  type text NOT NULL,
  payload jsonb NOT NULL,
  correlation_id uuid NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbox_unpublished_idx ON outbox_event (created_at) WHERE published_at IS NULL;

CREATE TABLE audit_log (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES app_user(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  request_id uuid NOT NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);
