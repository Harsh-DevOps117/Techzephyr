import { z } from "zod";

const day = z.enum(["MON", "TUE", "WED", "THU", "FRI"]);
const roomType = z.enum(["classroom", "lecture_hall", "auditorium", "seminar_hall", "outdoor", "lab_cs", "lab_elec", "lab_phy", "workshop", "lab_civil"]);

export const bookingDraftSchema = z.object({
  attendance: z.number().int().positive().max(10000).nullable(),
  duration_periods: z.number().int().min(1).max(13).nullable(),
  windows: z.array(z.object({ day, from_period: z.number().int().min(1).max(13), to_period: z.number().int().min(1).max(13) })).max(10),
  room_types: z.array(roomType).min(1),
  needs: z.array(z.string().min(1).max(64)).max(20),
  requested_room: z.string().min(1).max(64).nullable(),
  mandatory_for_groups: z.array(z.string().min(1).max(64)).max(30),
  assumptions: z.array(z.string().min(1).max(200)).max(10),
  follow_up: z.string().min(1).max(300).nullable()
}).superRefine((value, context) => {
  for (const window of value.windows) if (window.to_period < window.from_period) context.addIssue({ code: z.ZodIssueCode.custom, message: "window end must be at or after its start" });
  if (value.duration_periods && value.windows.some((window) => window.to_period - window.from_period + 1 < value.duration_periods!)) context.addIssue({ code: z.ZodIssueCode.custom, message: "each proposed window must fit the requested duration" });
});

export type BookingDraft = z.infer<typeof bookingDraftSchema>;
