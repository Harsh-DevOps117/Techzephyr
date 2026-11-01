import type { BookingDraft } from "../../domain/booking/booking-draft.js";
import type { Day } from "../scheduling/solver.js";

const days: Day[] = ["MON", "TUE", "WED", "THU", "FRI"];
const dayName: Record<Day, string> = { MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday" };
const clock = ["", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM"];
const roomTypes = ["classroom", "lecture_hall", "auditorium", "seminar_hall", "outdoor", "lab_cs", "lab_elec", "lab_phy", "workshop", "lab_civil"] as const;

export type AvailabilityRoom = { id: string; name: string; type: string; allowed_uses: string[] };
export type Occupant = { room_id: string; day: string; start_period: number; end_period: number; label: string };

export type AvailabilityAsk = {
  date: string | null;
  day: Day | null;
  fromPeriod: number;
  toPeriod: number;
  roomHint: string | null;
  roomTypes: string[];
};

function kolkataDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts;
}

function addIsoDays(iso: string, daysToAdd: number) {
  const date = new Date(`${iso}T12:00:00+05:30`);
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function weekdayOf(iso: string): Day | null {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(new Date(`${iso}T12:00:00+05:30`)).slice(0, 3).toUpperCase();
  return days.find((day) => day === short) ?? null;
}

function nextDateForDay(day: Day) {
  const today = kolkataDate();
  for (let offset = 0; offset < 7; offset += 1) {
    const iso = addIsoDays(today, offset);
    if (weekdayOf(iso) === day) return iso;
  }
  return today;
}

function hourToPeriod(hour: number, evening: boolean) {
  let clockHour = hour;
  if ((evening && hour <= 11) || (!evening && hour <= 7)) clockHour = hour + 12;
  const map: Record<number, number> = { 8: 1, 9: 2, 10: 3, 11: 4, 12: 5, 14: 6, 15: 7, 16: 8, 17: 9, 18: 10, 19: 11, 20: 12, 21: 13 };
  return map[clockHour] ?? null;
}

export function readAvailabilityQuestion(text: string, draft?: BookingDraft | null): AvailabilityAsk {
  const lower = text.toLowerCase();
  let date: string | null = null;
  if (/\b(aaj|ajj|aajj|aj|today)\b/.test(lower)) date = kolkataDate();
  else if (/\b(kal|tomorrow)\b/.test(lower)) date = addIsoDays(kolkataDate(), 1);
  else {
    const iso = lower.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    const dmy = lower.match(/\b(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})\b/);
    const named = lower.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/);
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    if (iso) date = `${iso[1]}-${iso[2]}-${iso[3]}`;
    else if (dmy) {
      const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
      date = `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    } else if (named) {
      const month = months.indexOf(named[2].slice(0, 3)) + 1;
      const year = Number(kolkataDate().slice(0, 4));
      date = `${year}-${String(month).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
    }
  }

  const evening = /\b(pm|shaam|evening|night|raat)\b/.test(lower);
  const timed = [...lower.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)\b/g)];
  const periodWord = lower.match(/\b(?:period|p)\s*(\d{1,2})\b/);
  const time = timed.at(-1);
  let fromPeriod = periodWord ? Number(periodWord[1]) : time ? hourToPeriod(Number(time[1]), evening || time[3] === "pm") : null;
  if (fromPeriod !== null && (fromPeriod < 1 || fromPeriod > 13)) fromPeriod = null;
  if (fromPeriod === null && /\b(shaam|evening)\b/.test(lower)) fromPeriod = 10;
  if (draft?.windows[0] && fromPeriod === null) fromPeriod = draft.windows[0].from_period;
  const start = fromPeriod ?? 10;
  const toPeriod = draft?.windows[0]?.to_period && draft.windows[0].to_period >= start ? draft.windows[0].to_period : start;

  const hinted = lower.match(/\b(aud|auditorium|seminar(?: hall)?|lecture hall|lh-\d+|cr-\d+|outdoor|ground)\b/);
  const typeFromText = /auditorium|\baud\b/.test(lower) ? ["auditorium"]
    : /seminar/.test(lower) ? ["seminar_hall"]
      : /lecture|\blh-/.test(lower) ? ["lecture_hall"]
        : /outdoor|ground/.test(lower) ? ["outdoor"]
          : [];
  const dayWord = lower.match(/\b(mon|tue|wed|thu|fri|monday|tuesday|wednesday|thursday|friday|somvar|mangal|budh|guru|shukra)\b/);
  const wordDay: Day | null = dayWord ? ({ mon: "MON", tue: "TUE", wed: "WED", thu: "THU", fri: "FRI", som: "MON", man: "TUE", bud: "WED", gur: "THU", shu: "FRI" } as Record<string, Day>)[dayWord[1].slice(0, 3)] ?? null : null;
  const day = date ? weekdayOf(date) : wordDay ?? (draft?.windows[0]?.day ?? null);
  if (!date && day) date = nextDateForDay(day);

  return {
    date,
    day,
    fromPeriod: start,
    toPeriod,
    roomHint: hinted?.[0] ?? draft?.requested_room ?? null,
    roomTypes: typeFromText.length ? typeFromText : (draft?.room_types ?? []).filter((type) => roomTypes.includes(type as typeof roomTypes[number])),
  };
}

function overlaps(start: number, end: number, from: number, to: number) {
  return start <= to && end >= from;
}

export function judgeAvailability(input: {
  ask: AvailabilityAsk;
  rooms: AvailabilityRoom[];
  occupants: Occupant[];
  canRequest: boolean;
}) {
  const { ask, rooms, occupants, canRequest } = input;
  if (!ask.date) {
    return { free: null as boolean | null, reply: "Tell me a Monday to Friday date and a room. For example: kya 3 Nov ko auditorium 6 baje khali hai?", room: null as AvailabilityRoom | null, clash: null as string | null };
  }
  if (!ask.day) {
    return { free: false, reply: `${formatDate(ask.date)} weekend par campus week nahi hota. Monday se Friday ki date choose karo.`, room: null, clash: null };
  }
  const needle = ask.roomHint?.toLowerCase() ?? "";
  const named = needle
    ? rooms.filter((room) => room.id.toLowerCase() === needle || room.name.toLowerCase().includes(needle) || needle.includes(room.id.toLowerCase()))
    : [];
  const typed = rooms.filter((room) => ask.roomTypes.includes(room.type) && room.allowed_uses.includes("event"));
  const candidates = (named.length ? named : typed).filter((room) => room.allowed_uses.includes("event") || named.includes(room));
  const pool = candidates.length ? candidates : named;
  if (!pool.length) {
    return { free: null, reply: "Kaunsa room? Auditorium, seminar hall, ya lecture hall ka naam likho.", room: null, clash: null };
  }
  const when = `${formatDate(ask.date)} ${clock[ask.fromPeriod]}${ask.toPeriod !== ask.fromPeriod ? `–${clock[ask.toPeriod]}` : ""}`;
  const freeRoom = pool.find((room) => !occupants.some((item) => item.room_id === room.id && item.day === ask.day && overlaps(item.start_period, item.end_period, ask.fromPeriod, ask.toPeriod)));
  if (freeRoom) {
    const help = canRequest ? " Main iske liye request bana sakta hoon." : " Book a venue se admin ise seedha book kar sakta hai. Request ki zaroorat nahi.";
    return { free: true, reply: `Haan, ${when} ko ${freeRoom.name} khali hai.${help}`, room: freeRoom, clash: null };
  }
  const taken = pool[0];
  const block = occupants.find((item) => item.room_id === taken.id && item.day === ask.day && overlaps(item.start_period, item.end_period, ask.fromPeriod, ask.toPeriod));
  return { free: false, reply: `Nahi, ${when} ko ${taken.name} khali nahi hai.${block ? ` ${block.label} wahan hai.` : ""}`, room: taken, clash: block?.label ?? "Another session" };
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00+05:30`));
}

export function draftForFreeSlot(ask: AvailabilityAsk, room: AvailabilityRoom): BookingDraft {
  const type = roomTypes.includes(room.type as typeof roomTypes[number]) ? room.type as typeof roomTypes[number] : "seminar_hall";
  return {
    attendance: 40,
    duration_periods: ask.toPeriod - ask.fromPeriod + 1,
    windows: [{ day: ask.day ?? "MON", from_period: ask.fromPeriod, to_period: ask.toPeriod }],
    room_types: [type],
    needs: [],
    requested_room: room.id,
    mandatory_for_groups: [],
    assumptions: [],
    follow_up: null,
  };
}

export function periodLabel(period: number) {
  return clock[period] ?? `P${period}`;
}

export { dayName };
