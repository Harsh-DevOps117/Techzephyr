INSERT INTO app_user (id, email, display_name, role, department, password_hash)
VALUES ('018f9f69-f6f2-7b5d-8a2b-531e5d44e018', 'reviewer@cit.local', 'CIT Reviewing Admin', 'admin', NULL, '$2b$12$A3v8/xgagcK3kTsVCpoKluOhnunLJdl6BZbVmusk6mSspRA.IDQy6')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS manual_event (
  id uuid PRIMARY KEY,
  schedule_version_id uuid NOT NULL REFERENCES schedule_version(id) ON DELETE CASCADE,
  title text NOT NULL,
  day text NOT NULL,
  start_period smallint NOT NULL CHECK (start_period BETWEEN 1 AND 13),
  end_period smallint NOT NULL CHECK (end_period BETWEEN start_period AND 13),
  room_id text NOT NULL,
  mandatory_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_event_schedule_slot_idx
  ON manual_event (schedule_version_id, room_id, day, start_period, end_period);
