export const roles = [
  "admin",
  "department_coordinator",
  "faculty",
  "club",
] as const;
export type Role = (typeof roles)[number];

export const jobTypes = [
  "GENERATE_SCHEDULE",
  "REPAIR_SCHEDULE",
  "DECIDE_BOOKINGS",
  "VALIDATE_SCHEDULE",
  "EXPORT_SCHEDULE",
] as const;
export type JobType = (typeof jobTypes)[number];

export type JobEnvelope = {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  correlationId: string;
};
