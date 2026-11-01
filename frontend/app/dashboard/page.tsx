"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { BookingDraft } from "../../lib/types";
import { roomCards, scheduleCards, useApiList, useCatalog, type ScheduleSummary } from "../../lib/catalog";
import { PickerCards } from "../../components/smart/picker-cards";
import { canOpen } from "../../lib/access";
import { Feedback } from "../../components/ui/feedback";
import { ArrowIcon, CalendarIcon, CheckIcon, VenueIcon, WrenchIcon } from "../../components/ui/icons";

type LiveItem = { session_id: string; day: string; start_period: number; room_id: string; courseId: string; kind: string; duration: number };
const weekdays = ["MON", "TUE", "WED", "THU", "FRI"] as const;

function weekdayFromDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const name = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getDay()];
  return weekdays.find((day) => day === name) ?? null;
}

function atLeastOne(value: string) {
  if (value.trim() === "") return null;
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 1) return undefined;
  return number;
}

export default function Home() {
  const schedules = useApiList<ScheduleSummary>("/api/v1/schedules");
  const approved = schedules.items.filter((item) => item.status === "approved");
  const [request, setRequest] = useState("seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye");
  const [status, setStatus] = useState("Describe a venue request in English or Hinglish.");
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [windowDates, setWindowDates] = useState<string[]>([]);
  const [needsText, setNeedsText] = useState("");
  const [limitNote, setLimitNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookingTitle, setBookingTitle] = useState("Campus venue request");
  const [bookingSchedule, setBookingSchedule] = useState("");
  const [bookingCategory, setBookingCategory] = useState("club_event");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [role, setRole] = useState("");
  const [overview, setOverview] = useState<{ counts: { sessions: number; bookingRequests: number }; roomUtilization: number; pendingApprovals: number; latestSchedule: { id: string; hardViolations: number; softPenalty: number } | null } | null>(null);
  const [liveItems, setLiveItems] = useState<LiveItem[]>([]);
  const catalog = useCatalog(bookingSchedule);
  const eventRooms = useMemo(
    () => (catalog.catalog?.rooms ?? []).filter((room) => room.allowedUses.includes("event")),
    [catalog.catalog],
  );

  useEffect(() => {
    setRole(localStorage.getItem("tz_role") ?? "");
    fetch("/backend/health").then((response) => setApiOnline(response.ok)).catch(() => setApiOnline(false));
    api<{ counts: { sessions: number; bookingRequests: number }; roomUtilization: number; pendingApprovals: number; latestSchedule: { id: string; hardViolations: number; softPenalty: number } | null }>("/api/v1/dashboard").then((response) => response.data && setOverview(response.data));
  }, []);

  useEffect(() => {
    const scheduleId = overview?.latestSchedule?.id;
    if (!scheduleId) {
      setLiveItems([]);
      return;
    }
    api<{ items: LiveItem[] }>(`/api/v1/schedules/${scheduleId}/timetable`).then((response) => {
      if (response.data) setLiveItems(response.data.items);
    });
  }, [overview?.latestSchedule?.id]);

  useEffect(() => {
    if (!draft?.requested_room || eventRooms.length === 0) return;
    const needle = draft.requested_room.toLowerCase();
    const match = eventRooms.find((room) => room.id.toLowerCase() === needle || room.name.toLowerCase() === needle);
    if (match && draft.requested_room !== match.id) setDraft({ ...draft, requested_room: match.id });
  }, [draft, eventRooms]);

  async function parse(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("Reading your request…");
    const response = await api<{ draft: BookingDraft | null; message?: string }>("/api/v1/ai/booking-drafts", { method: "POST", body: JSON.stringify({ text: request }) });
    setBusy(false);
    if (!response.data?.draft) {
      setStatus(response.data?.message ?? response.error ?? "AI is unavailable. The manual venue form remains available.");
      return;
    }
    setDraft(response.data.draft);
    setWindowDates(response.data.draft.windows.map(() => ""));
    setNeedsText(response.data.draft.needs.join(", "));
    setLimitNote("");
    setStatus("Draft created — set the date you want, then review every field before submission.");
  }

  function useManualForm() {
    setDraft({ attendance: null, duration_periods: null, windows: [{ day: "MON", from_period: 10, to_period: 11 }], room_types: ["seminar_hall"], needs: [], requested_room: null, mandatory_for_groups: [], assumptions: [], follow_up: null });
    setWindowDates([""]);
    setNeedsText("");
    setLimitNote("");
    setStatus("Manual form opened. Choose your date, then fill every field before submitting.");
  }

  function setCount(field: "attendance" | "duration_periods", raw: string) {
    if (!draft) return;
    const next = atLeastOne(raw);
    if (next === undefined) {
      setLimitNote(field === "attendance" ? "Attendance cannot be negative or zero." : "Duration cannot be negative or zero.");
      return;
    }
    setLimitNote("");
    const cleared = { ...draft, follow_up: null };
    if (field === "duration_periods" && next !== null) {
      const duration = Math.min(13, next);
      const windows = draft.windows.map((window) => window.to_period - window.from_period + 1 >= duration ? window : { ...window, to_period: Math.min(13, window.from_period + duration - 1) });
      setDraft({ ...cleared, duration_periods: duration, windows });
      return;
    }
    setDraft({ ...cleared, attendance: next });
  }

  function updateWindow(index: number, patch: Partial<BookingDraft["windows"][number]>, date?: string) {
    if (!draft) return;
    const windows = draft.windows.map((window, item) => item === index ? { ...window, ...patch } : window);
    setDraft({ ...draft, windows, follow_up: null });
    if (date !== undefined) setWindowDates(windowDates.map((item, itemIndex) => itemIndex === index ? date : item));
  }

  function formProblem() {
    if (!draft) return "Open the draft or the manual form first.";
    if (!draft.attendance || draft.attendance < 1) return "Attendance must be 1 or more.";
    if (!draft.duration_periods || draft.duration_periods < 1) return "Duration must be 1 or more periods.";
    if (!bookingTitle.trim() || bookingTitle.trim().length < 3) return "Add a request title of at least 3 characters.";
    if (!bookingSchedule) return "Choose the approved timetable card.";
    if (draft.windows.length === 0) return "Add at least one Monday to Friday date.";
    if (draft.windows.some((window) => window.from_period < 1 || window.to_period < window.from_period || window.to_period > 13)) return "Each date needs a from period and a to period between 1 and 13.";
    if (draft.windows.some((window) => window.to_period - window.from_period + 1 < (draft.duration_periods ?? 1))) return "The date window must be long enough for the duration.";
    return "";
  }

  async function submitDraft() {
    if (!draft) return;
    const problem = formProblem();
    if (problem) {
      setLimitNote(problem);
      setStatus(problem);
      return;
    }
    const needs = needsText.split(",").map((item) => item.trim()).filter(Boolean);
    setBusy(true);
    const response = await api<{ status: string; booked?: boolean; clash?: string; proposedDecision: { status: string; reason: string } }>("/api/v1/booking-requests", {
      method: "POST",
      body: JSON.stringify({ scheduleVersionId: bookingSchedule, title: bookingTitle.trim(), requestedCategory: bookingCategory, draft: { ...draft, needs, follow_up: null } }),
    });
    setBusy(false);
    if (!response.data) {
      setStatus(response.error ?? "Request could not be submitted");
      return;
    }
    const decision = response.data.proposedDecision;
    if (response.data.booked) setStatus(`Booked. ${decision.reason}`);
    else if (response.data.clash) setStatus(`Clash. ${response.data.clash}`);
    else setStatus(`Submitted as ${bookingCategory.replaceAll("_", " ")} for review · ${decision.status.replaceAll("_", " ")}: ${decision.reason}`);
  }

  function openBooking() {
    if (!draft) useManualForm();
    setBookingOpen(true);
  }

  const roomChoices = [
    { id: "", title: "Any suitable room", description: "Let the rules pick a venue that fits", meta: "No preference" },
    ...roomCards(eventRooms),
  ];
  const basicsReady = Boolean(draft && bookingTitle.trim().length >= 3 && (draft.attendance ?? 0) >= 1 && (draft.duration_periods ?? 0) >= 1);
  const datesReady = Boolean(basicsReady && draft && draft.windows.every((window) => window.from_period >= 1 && window.to_period >= window.from_period && window.to_period <= 13 && window.to_period - window.from_period + 1 >= (draft.duration_periods ?? 1)));
  const week = weekdays.map((day) => ({
    day,
    items: liveItems.filter((item) => item.day === day).sort((a, b) => a.start_period - b.start_period),
  }));

  return (
    <main className="dashboard">
      <header className="topline">
        <div>
          <p className="eyebrow">CAMPUS CONTROL CENTRE</p>
          <h1>Campus workspace</h1>
          <p>The published week is below. Book a venue when you need a room.</p>
        </div>
        <div className="topline-actions">
          <button className="primary" type="button" onClick={openBooking}>Book a venue</button>
          <div className={`api-state ${apiOnline === false ? "offline" : ""}`}><i />{apiOnline === null ? "Checking services" : apiOnline ? "All services operational" : "API unavailable"}</div>
        </div>
      </header>
      <ol className="step-rail">
        {([
          ["/datasets", "1", "Import the dataset", "Data manager"],
          ["/schedule", "2", "Generate the week", "Timetable"],
          ["/approvals", "3", "Approve it", "A different admin"],
          ["/bookings", "4", "Decide venues", "Spectra requests"],
        ] as const).map(([href, number, title, detail]) => (
          <li key={href}>
            {!role || canOpen(role, href) ? (
              <Link href={href}><b>{number}</b><span>{title}</span><small>{detail}</small></Link>
            ) : (
              <span className="locked"><b>{number}</b><span>{title}</span><small>Another role</small></span>
            )}
          </li>
        ))}
      </ol>
      <section className="attention-grid">
        <article className="attention hero-card"><span className="card-icon coral"><CalendarIcon /></span><div><small>TIMETABLE</small><strong>{overview ? `${overview.counts.sessions} sessions` : "No dataset yet"}</strong><p>{overview?.latestSchedule ? `${overview.latestSchedule.hardViolations} hard conflicts · ${overview.roomUtilization}% room utilisation` : "Import a dataset, then generate the week."}</p></div><Link href="/schedule">Open scheduler <ArrowIcon /></Link></article>
        {(!role || canOpen(role, "/repair")) && <article className="attention"><span className="card-icon violet"><WrenchIcon /></span><div><small>CHANGES</small><strong>Repair safely</strong><p>Upload disruptions and review every move.</p></div><Link href="/repair">Plan a repair <ArrowIcon /></Link></article>}
        <article className="attention"><span className="card-icon mint"><VenueIcon /></span><div><small>SPECTRA WEEK</small><strong>{overview ? `${overview.counts.bookingRequests} requests` : "No requests yet"}</strong><p>{overview?.pendingApprovals ?? 0} validated proposals await approval.</p></div><Link href="/bookings">Review requests <ArrowIcon /></Link></article>
      </section>
      <section className="panel week-panel">
        <div className="panel-title"><div><p className="eyebrow">TIMETABLE PREVIEW</p><h2>{liveItems.length ? "Latest generated week" : "No live timetable yet"}</h2></div><Link href="/schedule">Full timetable <ArrowIcon /></Link></div>
        {liveItems.length === 0 ? <p className="lede">Generate a week and these columns fill from that schedule.</p> : (
          <div className="week-board">
            {week.map((column) => (
              <section key={column.day}>
                <h3>{column.day}</h3>
                {column.items.slice(0, 6).map((item) => (
                  <div className={`week-chip ${item.kind}`} key={item.session_id}>
                    <b>P{item.start_period}</b>
                    <span>{item.courseId}</span>
                    <small>{item.room_id}</small>
                  </div>
                ))}
                {column.items.length > 6 && <small className="week-more">+{column.items.length - 6} more</small>}
                {column.items.length === 0 && <small className="week-more">No sessions</small>}
              </section>
            ))}
          </div>
        )}
      </section>
      {bookingOpen && draft && (
        <div className="fog" onClick={() => setBookingOpen(false)}>
          <div className="fog-card" role="dialog" aria-modal="true" aria-labelledby="book-venue-title" onClick={(event) => event.stopPropagation()}>
            <div className="fog-head">
              <div><p className="eyebrow">VENUE</p><h2 id="book-venue-title">Book a venue</h2></div>
              <button type="button" className="ghost" onClick={() => setBookingOpen(false)}>Close</button>
            </div>
            <p className="lede">{role === "admin" ? "An admin booking is applied immediately. A clash is reported here and is not sent for review." : "Fill the first fields. The next section appears when they are complete."}</p>
            <form onSubmit={parse}>
              <label>Describe it<textarea value={request} onChange={(event) => setRequest(event.target.value)} /></label>
              <button className="secondary" disabled={busy}>{busy ? "Reading…" : "Fill from this sentence"}</button>
            </form>
            <div className="draft-fields">
              <label>Request title<input value={bookingTitle} onChange={(event) => setBookingTitle(event.target.value)} /></label>
              <label>Category
                <select value={bookingCategory} onChange={(event) => setBookingCategory(event.target.value)}>
                  <option value="club_event">Club event</option>
                  <option value="department_event">Department event</option>
                  <option value="guest_lecture">Guest lecture</option>
                  <option value="institute_event">Institute event</option>
                </select>
                <small>A club can request an institute event, a guest lecture, a department event, or a club event. The category you choose is the one used.</small>
              </label>
              <label>Attendance<input type="number" min={1} step={1} value={draft.attendance ?? ""} onChange={(event) => setCount("attendance", event.target.value)} /></label>
              <label>Duration in periods<input type="number" min={1} max={13} step={1} value={draft.duration_periods ?? ""} onChange={(event) => setCount("duration_periods", event.target.value)} /></label>
              <label>Requirements<input value={needsText} placeholder="mic, projector, stage" onChange={(event) => { setNeedsText(event.target.value); setDraft({ ...draft, follow_up: null }); setLimitNote(""); }} /></label>
            </div>
            {basicsReady && (
              <div className="fog-next">
                <p className="eyebrow">Next</p>
                <h3>Dates you want</h3>
                <div className="window-list">
                  {draft.windows.map((window, index) => (
                    <div className="window-row" key={`${window.day}-${index}`}>
                      <label>Date<input type="date" value={windowDates[index] ?? ""} onChange={(event) => {
                        const value = event.target.value;
                        const day = value ? weekdayFromDate(value) : null;
                        if (value && !day) {
                          setLimitNote("Pick a Monday to Friday date. The campus week does not use Saturday or Sunday.");
                          return;
                        }
                        setLimitNote("");
                        updateWindow(index, day ? { day } : {}, value);
                      }} /></label>
                      <label>Day<select value={window.day} onChange={(event) => updateWindow(index, { day: event.target.value as BookingDraft["windows"][number]["day"] }, "")}>{weekdays.map((day) => <option key={day} value={day}>{day}</option>)}</select></label>
                      <label>From period<input type="number" min={1} max={13} value={window.from_period} onChange={(event) => {
                        const from = atLeastOne(event.target.value);
                        if (from === undefined || from === null) { setLimitNote("A period cannot be negative or zero."); return; }
                        setLimitNote("");
                        updateWindow(index, { from_period: Math.min(13, from), to_period: Math.max(window.to_period, Math.min(13, from)) });
                      }} /></label>
                      <label>To period<input type="number" min={1} max={13} value={window.to_period} onChange={(event) => {
                        const to = atLeastOne(event.target.value);
                        if (to === undefined || to === null) { setLimitNote("A period cannot be negative or zero."); return; }
                        setLimitNote("");
                        updateWindow(index, { to_period: Math.max(window.from_period, Math.min(13, to)) });
                      }} /></label>
                      {draft.windows.length > 1 && <button type="button" className="ghost" onClick={() => { setDraft({ ...draft, windows: draft.windows.filter((_, item) => item !== index) }); setWindowDates(windowDates.filter((_, item) => item !== index)); }}>Remove</button>}
                    </div>
                  ))}
                  {draft.windows.length < 5 && <button type="button" className="secondary" onClick={() => { setDraft({ ...draft, windows: [...draft.windows, { day: "FRI", from_period: 10, to_period: 11 }] }); setWindowDates([...windowDates, ""]); }}>Add another date</button>}
                </div>
              </div>
            )}
            {datesReady && (
              <div className="fog-next">
                <p className="eyebrow">Next</p>
                <PickerCards
                  label="Approved timetable"
                  hint="The request is checked against this published schedule"
                  items={scheduleCards(approved)}
                  selectedId={bookingSchedule}
                  onSelect={setBookingSchedule}
                  loading={schedules.loading}
                  error={schedules.error}
                  empty="Approve a timetable before booking a venue."
                />
                {bookingSchedule && (
                  <PickerCards
                    label="Preferred room"
                    hint="Optional. Any suitable room leaves the choice to the rules."
                    items={roomChoices}
                    selectedId={draft.requested_room ?? ""}
                    onSelect={(id) => setDraft({ ...draft, requested_room: id || null })}
                    loading={catalog.loading}
                    error={catalog.error}
                    empty="This timetable has no event rooms."
                  />
                )}
                <button type="button" className="primary wide" disabled={busy || !bookingSchedule} onClick={submitDraft}>{busy ? "Checking the week…" : role === "admin" ? "Book this venue" : "Submit for review"}<ArrowIcon /></button>
              </div>
            )}
            {limitNote && <p className="error">{limitNote}</p>}
            {status.startsWith("Clash") && <Feedback tone="error" title="This time clashes">{status.replace(/^Clash\.\s*/, "")}</Feedback>}
            {status.startsWith("Booked") && <Feedback tone="success" title="Venue booked">{status.replace(/^Booked\.\s*/, "")}</Feedback>}
            {!status.startsWith("Clash") && !status.startsWith("Booked") && status && <p className="helper-text">{status}</p>}
          </div>
        </div>
      )}
      <section className="trust-strip">
        <span><CheckIcon /> AI never approves a booking</span>
        <span><CheckIcon /> Every proposal is code-validated</span>
        <span><CheckIcon /> Admin approval required for changes</span>
      </section>
    </main>
  );
}
