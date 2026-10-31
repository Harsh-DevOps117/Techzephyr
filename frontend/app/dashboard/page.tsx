"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { BookingDraft } from "../../lib/types";
import { roomCards, scheduleCards, useApiList, useCatalog, type ScheduleSummary } from "../../lib/catalog";
import { PickerCards } from "../../components/smart/picker-cards";
import { canOpen } from "../../lib/access";
import { ArrowIcon, CalendarIcon, CheckIcon, MessageIcon, VenueIcon, WrenchIcon } from "../../components/ui/icons";

type LiveItem = { session_id: string; day: string; start_period: number; room_id: string; courseId: string; kind: string; duration: number };

export default function Home() {
  const schedules = useApiList<ScheduleSummary>("/api/v1/schedules");
  const approved = schedules.items.filter((item) => item.status === "approved");
  const [request, setRequest] = useState("seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye");
  const [status, setStatus] = useState("Describe a venue request in English or Hinglish.");
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookingTitle, setBookingTitle] = useState("Campus venue request");
  const [bookingSchedule, setBookingSchedule] = useState("");
  const [bookingCategory, setBookingCategory] = useState("club_event");
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
      if (response.data) setLiveItems(response.data.items.slice(0, 8));
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
    const response = await api<{ draft: BookingDraft }>("/api/v1/ai/booking-drafts", { method: "POST", body: JSON.stringify({ text: request }) });
    setBusy(false);
    if (!response.data) {
      setStatus(response.error ?? "AI is unavailable. The manual venue form remains available.");
      return;
    }
    setDraft(response.data.draft);
    setStatus("Draft created — review every field before submission.");
  }

  function useManualForm() {
    setDraft({ attendance: null, duration_periods: null, windows: [{ day: "MON", from_period: 10, to_period: 11 }], room_types: ["seminar_hall"], needs: [], requested_room: null, mandatory_for_groups: [], assumptions: [], follow_up: null });
    setStatus("Manual form opened. Fill every field before submitting.");
  }

  async function submitDraft() {
    if (!draft) return;
    setBusy(true);
    const response = await api<{ status: string; proposedDecision: { status: string; reason: string } }>("/api/v1/booking-requests", {
      method: "POST",
      body: JSON.stringify({ scheduleVersionId: bookingSchedule, title: bookingTitle, requestedCategory: bookingCategory, draft }),
    });
    setBusy(false);
    if (!response.data) {
      setStatus(response.error ?? "Request could not be submitted");
      return;
    }
    setStatus(`Submitted for review · ${response.data.proposedDecision.status.replaceAll("_", " ")}: ${response.data.proposedDecision.reason}`);
  }

  const roomChoices = [
    { id: "", title: "Any suitable room", description: "Let the rules pick a venue that fits", meta: "No preference" },
    ...roomCards(eventRooms),
  ];

  return (
    <main className="dashboard">
      <header className="topline">
        <div>
          <p className="eyebrow">CAMPUS CONTROL CENTRE</p>
          <h1>What should happen next.</h1>
          <p>Follow the four steps. Each screen tells you the one card to click.</p>
        </div>
        <div className={`api-state ${apiOnline === false ? "offline" : ""}`}><i />{apiOnline === null ? "Checking services" : apiOnline ? "All services operational" : "API unavailable"}</div>
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
      <section className="dashboard-grid">
        <article className="panel timetable-panel">
          <div className="panel-title"><div><p className="eyebrow">TIMETABLE PREVIEW</p><h2>{liveItems.length ? "Latest generated week" : "No live timetable yet"}</h2></div><Link href="/schedule">Full timetable <ArrowIcon /></Link></div>
          {liveItems.length === 0 ? <p className="lede">Generate a week and this list fills from that schedule. Nothing here is sample data.</p> : (
            <div className="schedule-table">
              <div className="table-head"><span>When</span><span>Course</span><span>Kind</span><span>Room</span></div>
              {liveItems.map((item) => (
                <div key={item.session_id}><span>{item.day} · P{item.start_period}</span><span>{item.courseId}</span><span>{item.kind}</span><span>{item.room_id}</span></div>
              ))}
            </div>
          )}
        </article>
        <article className="panel assistant-panel">
          <div className="assistant-title"><span className="card-icon coral"><MessageIcon /></span><div><p className="eyebrow">REQUEST ASSISTANT</p><h2>Book a venue naturally</h2></div></div>
          <p>Tell us what you need. AI fills the form; deterministic rules decide availability.</p>
          <form onSubmit={parse}>
            <label>Your request<textarea value={request} onChange={(event) => setRequest(event.target.value)} /></label>
            <button className="primary" disabled={busy}>{busy ? "Creating draft…" : "Create editable draft"}<ArrowIcon /></button>
            <button type="button" className="secondary manual-fallback" onClick={useManualForm}>Use manual form</button>
          </form>
          <p className="helper-text">{status}</p>
          {draft && (
            <div className="draft-card">
              <div className="draft-head"><span><CheckIcon /> Draft ready</span><small>Not submitted</small></div>
              <div className="draft-fields">
                <label>Attendance<input type="number" value={draft.attendance ?? ""} onChange={(event) => setDraft({ ...draft, attendance: event.target.value ? Number(event.target.value) : null })} /></label>
                <label>Duration<input type="number" value={draft.duration_periods ?? ""} onChange={(event) => setDraft({ ...draft, duration_periods: event.target.value ? Number(event.target.value) : null })} /></label>
                <label>Needs<input value={draft.needs.join(", ")} onChange={(event) => setDraft({ ...draft, needs: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
                <label>Request title<input value={bookingTitle} onChange={(event) => setBookingTitle(event.target.value)} /></label>
                <label>Category
                  <select value={bookingCategory} onChange={(event) => setBookingCategory(event.target.value)}>
                    <option value="club_event">Club event</option>
                    <option value="department_event">Department event</option>
                    <option value="guest_lecture">Guest lecture</option>
                    <option value="institute_event">Institute event</option>
                  </select>
                </label>
              </div>
              <PickerCards
                label="Approved timetable"
                hint="The request is checked against this published schedule"
                items={scheduleCards(approved)}
                selectedId={bookingSchedule}
                onSelect={setBookingSchedule}
                loading={schedules.loading}
                error={schedules.error}
                empty="Approve a timetable before submitting a venue request."
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
              {draft.follow_up && <p className="follow-up">Needs clarification: {draft.follow_up}</p>}
              <button type="button" className="primary wide" disabled={busy || !bookingSchedule || !!draft.follow_up} onClick={submitDraft}>Submit for deterministic review <ArrowIcon /></button>
            </div>
          )}
        </article>
      </section>
      <section className="trust-strip">
        <span><CheckIcon /> AI never approves a booking</span>
        <span><CheckIcon /> Every proposal is code-validated</span>
        <span><CheckIcon /> Admin approval required for changes</span>
      </section>
    </main>
  );
}
