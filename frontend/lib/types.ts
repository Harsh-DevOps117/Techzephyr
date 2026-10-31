export type Role = "admin" | "department_coordinator" | "faculty" | "club";

export type BookingWindow = {
  day: "MON" | "TUE" | "WED" | "THU" | "FRI";
  from_period: number;
  to_period: number;
};

export type BookingDraft = {
  attendance: number | null;
  duration_periods: number | null;
  windows: BookingWindow[];
  room_types: string[];
  needs: string[];
  requested_room: string | null;
  mandatory_for_groups: string[];
  assumptions: string[];
  follow_up: string | null;
};

export type Job = {
  id: string;
  type: string;
  priority: number;
  status: "queued" | "running" | "succeeded" | "failed" | "dead_lettered";
  error?: string | null;
  attempt_count: number;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
};

export type DatasetFile = {
  dataset_id?: string;
  rooms?: unknown[];
  faculty?: unknown[];
  student_groups?: unknown[];
  courses?: unknown[];
  sessions?: unknown[];
  booking_requests?: unknown[];
  exams?: unknown[];
};

export type DisruptionFile = { changes?: Array<{ type?: string; reason?: string }> };
