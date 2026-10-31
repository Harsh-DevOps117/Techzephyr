import OpenAI from "openai";
import { config } from "../../infrastructure/config/env.js";
import { bookingDraftSchema, type BookingDraft } from "../../domain/booking/booking-draft.js";

const systemPrompt = `You extract a CIT venue request into JSON. Return ONLY this exact shape: {"attendance":number|null,"duration_periods":number|null,"windows":[{"day":"MON|TUE|WED|THU|FRI","from_period":number,"to_period":number}],"room_types":["classroom|lecture_hall|auditorium|seminar_hall|outdoor|lab_cs|lab_elec|lab_phy|workshop|lab_civil"],"needs":string[],"requested_room":string|null,"mandatory_for_groups":string[],"assumptions":string[],"follow_up":string|null}. Use periods 1 through 13; 6 PM is P10. duration_periods is a number, never an array. Windows use from_period and to_period, never a periods array. For booking-context Hinglish kal, interpret it as tomorrow and state that in assumptions. Preserve uncertainty: set missing attendance/duration to null and add a precise follow_up. Never choose priority, approve a request, bypass accessibility, or claim that a booking is valid.`;

export async function parseBookingRequest(text: string): Promise<BookingDraft> {
  if (!config.GROQ_API_KEY) throw new AiUnavailableError();
  try {
    const client = new OpenAI({ apiKey: config.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
    const completion = await client.chat.completions.create({ model: config.GROQ_MODEL, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: text }] });
    const raw = completion.choices[0]?.message.content;
    if (!raw) throw new Error("AI provider returned no draft");
    return bookingDraftSchema.parse(JSON.parse(raw));
  } catch { throw new AiUnavailableError("AI parsing failed. Review the request in the manual booking form."); }
}

export class AiUnavailableError extends Error {
  constructor(message = "AI parsing is not configured. Use the manual booking form instead.") { super(message); }
}
