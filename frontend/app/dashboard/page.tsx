"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { BookingDraft } from "../../lib/types";
import { roomCards, scheduleCards, useApiList, useCatalog, type ScheduleSummary } from "../../lib/catalog";
import { PickerCards } from "../../components/smart/picker-cards";
import { canOpen } from "../../lib/access";
import { Feedback } from "../../components/ui/feedback";
import { ArrowIcon, CalendarIcon, CheckIcon, CloseIcon, MessageIcon, VenueIcon, WrenchIcon } from "../../components/ui/icons";

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
  const [status, setStatus] = useState("Fill the fields. The next step appears when they are complete.");
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [windowDates, setWindowDates] = useState<string[]>([]);
  const [needsText, setNeedsText] = useState("");
  const [limitNote, setLimitNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestJob, setRequestJob] = useState("");
  const [bookingTitle, setBookingTitle] = useState("Campus venue request");
  const [bookingSchedule, setBookingSchedule] = useState("");
  const [bookingCategory, setBookingCategory] = useState("club_event");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [question, setQuestion] = useState("kya 3 Nov ko auditorium 6 baje khali hai?");
  const [answer, setAnswer] = useState("");
  const [offerRequest, setOfferRequest] = useState(false);
  const [askBusy, setAskBusy] = useState(false);
  const [prepared, setPrepared] = useState<{ draft: BookingDraft; date: string | null; scheduleVersionId: string; roomName: string; alternative: boolean } | null>(null);
  const [aiAssistedBooking, setAiAssistedBooking] = useState(false);
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

  function useManualForm() {
    setAiAssistedBooking(false);
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
    const response = await api<{ jobId?: string; status: string; booked?: boolean; clash?: string; proposedDecision: { status: string; reason: string } }>("/api/v1/booking-requests", {
      method: "POST",
      body: JSON.stringify({ scheduleVersionId: bookingSchedule, title: bookingTitle.trim(), requestedCategory: bookingCategory, draft: { ...draft, needs, follow_up: null }, aiAssisted: aiAssistedBooking }),
    });
    setBusy(false);
    if (!response.data) {
      setStatus(response.error ?? "Request could not be submitted");
      return;
    }
    const decision = response.data.proposedDecision;
    setRequestJob(response.data.jobId ?? "");
    if (response.data.booked) setStatus(`Booked. ${decision.reason}`);
    else if (response.data.clash) setStatus(`Clash. ${response.data.clash}`);
    else setStatus(`Submitted as ${bookingCategory.replaceAll("_", " ")} for review · ${decision.status.replaceAll("_", " ")}: ${decision.reason}`);
  }

  function openBooking() {
    if (!draft) useManualForm();
    setBookingOpen(true);
  }

  async function askAvailability(event: FormEvent) {
    event.preventDefault();
    setAskBusy(true);
    setOfferRequest(false);
    setPrepared(null);
    const response = await api<{ reply: string; offerRequest: boolean; draft: BookingDraft | null; date: string | null; scheduleVersionId: string | null; room: { name: string } | null; alternative: { room: { name: string } } | null }>("/api/v1/ai/availability", {
      method: "POST",
      body: JSON.stringify({ text: question }),
    });
    setAskBusy(false);
    if (!response.data) {
      setAnswer(response.error ?? "Could not check that slot");
      return;
    }
    setAnswer(response.data.reply);
    setOfferRequest(Boolean(response.data.offerRequest && response.data.draft && response.data.scheduleVersionId));
    if (response.data.offerRequest && response.data.draft && response.data.scheduleVersionId) {
      setPrepared({ draft: response.data.draft, date: response.data.date, scheduleVersionId: response.data.scheduleVersionId, roomName: response.data.alternative?.room.name ?? response.data.room?.name ?? "Venue", alternative: Boolean(response.data.alternative) });
    }
  }

  function startRequestFromAnswer() {
    if (!prepared) return;
    setAiAssistedBooking(true);
    setDraft(prepared.draft);
    setWindowDates([prepared.date ?? ""]);
    setNeedsText((prepared.draft.needs ?? []).join(", "));
    setLimitNote("");
    setBookingTitle(`${prepared.roomName} request`);
    setBookingSchedule(prepared.scheduleVersionId);
    setBookingCategory(role === "faculty" ? "guest_lecture" : role === "department_coordinator" ? "department_event" : "club_event");
    setStatus(prepared.alternative ? "A conflict-free alternative is ready. Check the fields, then submit it for review." : "The slot is free. Check the fields, then submit the request.");
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
      <section className="action-row">
        <Link className="action-card" href="/schedule">
          <span className="action-icon"><CalendarIcon /></span>
          <span className="action-copy"><strong>{overview ? overview.counts.sessions : "—"}</strong><span>Sessions</span><small>{overview?.latestSchedule ? `${overview.latestSchedule.hardViolations} hard conflicts` : "Open the timetable"}</small></span>
        </Link>
        {(!role || canOpen(role, "/repair")) && (
          <Link className="action-card" href="/repair">
            <span className="action-icon"><WrenchIcon /></span>
            <span className="action-copy"><strong className="action-title">Repair safely</strong><span>Changes</span><small>Review every move</small></span>
          </Link>
        )}
        <Link className="action-card" href="/bookings">
          <span className="action-icon"><VenueIcon /></span>
          <span className="action-copy"><strong>{overview ? overview.counts.bookingRequests : "—"}</strong><span>Requests</span><small>{overview ? `${overview.pendingApprovals} waiting` : "Open requests"}</small></span>
        </Link>
      </section>
      <div className="ai-dock">
        {chatOpen && (
          <section className="ai-panel" role="dialog" aria-label="Ask the assistant">
            <div className="ai-panel-head"><p className="eyebrow">ASSISTANT</p><h2>Is this room free?</h2></div>
            <p>Ask in English or Hinglish. The timetable decides.</p>
            <form onSubmit={askAvailability}>
              <label className="sr-only" htmlFor="availability-question">Question</label>
              <textarea id="availability-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="kya 3 Nov ko auditorium 6 baje khali hai?" />
              <button className="primary" type="submit" disabled={askBusy || question.trim().length < 3}>{askBusy ? "Checking…" : "Ask"}</button>
            </form>
            {answer && <p className="ask-reply">{answer}</p>}
            {offerRequest && <button type="button" className="secondary" onClick={() => { startRequestFromAnswer(); setChatOpen(false); }}>Make this request</button>}
          </section>
        )}
        <button type="button" className="ai-launcher" aria-expanded={chatOpen} aria-label={chatOpen ? "Close assistant" : "Talk to the assistant"} onClick={() => setChatOpen((open) => !open)}>
          {chatOpen ? <CloseIcon /> : <MessageIcon />}
        </button>
      </div>
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
            <div className="fog-steps">
              <span className="on">1 Details</span>
              <span className={basicsReady ? "on" : ""}>2 Dates</span>
              <span className={datesReady ? "on" : ""}>3 Timetable</span>
            </div>
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
            {!status.startsWith("Clash") && !status.startsWith("Booked") && status.startsWith("Submitted") && <Feedback tone="success" title="Request recorded">{status}</Feedback>}
            {!status.startsWith("Clash") && !status.startsWith("Booked") && !status.startsWith("Submitted") && status && <p className="helper-text">{status}</p>}
            {requestJob && <p className="helper-text"><Link href={`/jobs?id=${requestJob}`}>Open the request job</Link></p>}
          </div>
        </div>
      )}
      <section className="trust-strip">
        <span><CheckIcon /> Every booking is checked by rules</span>
        <span><CheckIcon /> Every proposal is code-validated</span>
        <span><CheckIcon /> Admin approval required for changes</span>
      </section>
    </main>
  );
}
