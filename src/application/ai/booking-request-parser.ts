import OpenAI from "openai";
import { config } from "../../infrastructure/config/env.js";
import { bookingDraftSchema, type BookingDraft } from "../../domain/booking/booking-draft.js";

const systemPrompt = `You extract a CIT venue request into JSON. Return only attendance, duration_periods, windows, room_types, needs, requested_room, mandatory_for_groups, assumptions, follow_up. Use MON through FRI and periods 1 through 13. For booking-context Hinglish kal, interpret it as tomorrow and state that in assumptions. Preserve uncertainty: set missing attendance/duration to null and add a precise follow_up. Never choose priority, approve a request, bypass accessibility, or claim that a booking is valid.`;

export async function parseBookingRequest(text: string): Promise<BookingDraft> {
  if (!config.GROQ_API_KEY) throw new AiUnavailableError();
  const client = new OpenAI({ apiKey: config.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
  const completion = await client.chat.completions.create({ model: config.GROQ_MODEL, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: text }] });
  const raw = completion.choices[0]?.message.content;
  if (!raw) throw new Error("AI provider returned no draft");
  return bookingDraftSchema.parse(JSON.parse(raw));
}

export class AiUnavailableError extends Error {
  constructor() { super("AI parsing is not configured. Use the manual booking form instead."); }
}
