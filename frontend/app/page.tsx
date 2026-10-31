"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { BookingDraft } from "../lib/types";
import { ArrowIcon, CalendarIcon, CheckIcon, SparkIcon, WrenchIcon } from "../components/ui/icons";
const timetable = [
  { day: "MON", period: 2, span: 1, course: "MA101", label: "Calculus", room: "LH-1", tone: "blue" },
  { day: "MON", period: 4, span: 1, course: "CS101", label: "Programming", room: "LH-3", tone: "purple" },
  { day: "TUE", period: 2, span: 3, course: "CS101", label: "Programming Lab", room: "LAB-CS-1", tone: "purple" },
  { day: "WED", period: 3, span: 1, course: "PH101", label: "Physics", room: "LH-2", tone: "amber" },
  { day: "THU", period: 2, span: 1, course: "MA101", label: "Calculus", room: "LH-1", tone: "blue" },
  { day: "FRI", period: 6, span: 1, course: "HS101", label: "Communication", room: "CR-204", tone: "green" },
];
const days = ["MON", "TUE", "WED", "THU", "FRI"];
const periodTime = ["08", "09", "10", "11", "12", "14", "15", "16", "17"];
export default function Home() {
  const [request, setRequest] = useState("seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye");
  const [status, setStatus] = useState("Describe a venue request in English or Hinglish.");
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookingTitle,setBookingTitle]=useState("Campus venue request"),[bookingSchedule,setBookingSchedule]=useState(""),[bookingCategory,setBookingCategory]=useState("club_event");
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<{ counts: { sessions: number; bookingRequests: number }; roomUtilization:number; pendingApprovals: number; latestSchedule: { hardViolations: number; softPenalty: number } | null } | null>(null);
  useEffect(() => { fetch("/backend/health").then((r) => setApiOnline(r.ok)).catch(() => setApiOnline(false)); api<{ counts: { sessions: number; bookingRequests: number }; roomUtilization:number; pendingApprovals: number; latestSchedule: { hardViolations: number; softPenalty: number } | null }>("/api/v1/dashboard").then((r) => r.data && setOverview(r.data)); }, []);
  async function parse(event: FormEvent) {
    event.preventDefault(); setBusy(true); setStatus("Reading your request…");
    const response = await api<{ draft: BookingDraft }>("/api/v1/ai/booking-drafts", { method: "POST", body: JSON.stringify({ text: request }) });
    setBusy(false);
    if (!response.data) { setStatus(response.error ?? "AI is unavailable. The manual venue form remains available."); return; }
    setDraft(response.data.draft); setStatus("Draft created — review every field before submission.");
  }
  function useManualForm(){setDraft({attendance:null,duration_periods:null,windows:[{day:"MON",from_period:10,to_period:11}],room_types:["seminar_hall"],needs:[],requested_room:null,mandatory_for_groups:[],assumptions:[],follow_up:null});setStatus("Manual form opened. Fill every field before submitting.");}
  async function submitDraft(){if(!draft)return;setBusy(true);const response=await api<{status:string;proposedDecision:{status:string;reason:string}}>("/api/v1/booking-requests",{method:"POST",body:JSON.stringify({scheduleVersionId:bookingSchedule,title:bookingTitle,requestedCategory:bookingCategory,draft})});setBusy(false);if(!response.data){setStatus(response.error??"Request could not be submitted");return;}setStatus(`Submitted for review · ${response.data.proposedDecision.status.replaceAll("_"," ")}: ${response.data.proposedDecision.reason}`);}
  return <main className="dashboard">
    <header className="topline"><div><p className="eyebrow">CAMPUS CONTROL CENTRE</p><h1>Good morning, CIT Admin.</h1><p>Here’s what needs your attention across campus.</p></div><div className={`api-state ${apiOnline === false ? "offline" : ""}`}><i/>{apiOnline === null ? "Checking services" : apiOnline ? "All services operational" : "API unavailable"}</div></header>
    <section className="attention-grid">
      <article className="attention hero-card"><span className="card-icon coral"><CalendarIcon/></span><div><small>TIMETABLE</small><strong>{overview?.counts.sessions ?? 189} sessions</strong><p>{overview?.latestSchedule ? `${overview.latestSchedule.hardViolations} hard conflicts · ${overview.roomUtilization}% room utilisation` : "Ready to generate from the CIT dataset."}</p></div><Link href="/schedule">Open scheduler <ArrowIcon/></Link></article>
      <article className="attention"><span className="card-icon violet"><WrenchIcon/></span><div><small>CHANGES</small><strong>Repair safely</strong><p>Upload disruptions and review every move.</p></div><Link href="/repair">Plan a repair <ArrowIcon/></Link></article>
      <article className="attention"><span className="card-icon mint"><SparkIcon/></span><div><small>SPECTRA WEEK</small><strong>{overview?.counts.bookingRequests ?? 25} requests</strong><p>{overview?.pendingApprovals ?? 0} validated proposals await approval.</p></div><Link href="/bookings">Review requests <ArrowIcon/></Link></article>
    </section>
    <section className="dashboard-grid">
      <article className="panel timetable-panel"><div className="panel-title"><div><p className="eyebrow">TIMETABLE PREVIEW</p><h2>Year 2 · Computer Science</h2></div><Link href="/schedule">Full timetable <ArrowIcon/></Link></div><div className="timetable"><div className="times"><span/>{periodTime.map((p) => <span key={p}>{p}:00</span>)}</div>{days.map((day) => <div className="day-column" key={day}><b>{day}</b>{timetable.filter((e) => e.day === day).map((event) => <div key={event.course + event.period} className={`event ${event.tone}`} style={{ top: `${42 + (event.period - 1) * 42}px`, height: `${event.span * 38}px` }}><strong>{event.course}</strong><span>{event.label}</span><small>{event.room}</small></div>)}</div>)}</div><div className="legend-row"><span><i className="blue"/> Lecture</span><span><i className="purple"/> Lab</span><span><i className="amber"/> Tutorial</span><small>Preview data · connect a generated schedule for live placements</small></div></article>
      <article className="panel assistant-panel"><div className="assistant-title"><span className="card-icon coral"><SparkIcon/></span><div><p className="eyebrow">REQUEST ASSISTANT</p><h2>Book a venue naturally</h2></div></div><p>Tell us what you need. AI fills the form; deterministic rules decide availability.</p><form onSubmit={parse}><label>Your request<textarea value={request} onChange={(e) => setRequest(e.target.value)} /></label><button className="primary" disabled={busy}>{busy ? "Creating draft…" : "Create editable draft"}<ArrowIcon/></button><button type="button" className="secondary manual-fallback" onClick={useManualForm}>Use manual form</button></form><p className="helper-text">{status}</p>{draft && <div className="draft-card"><div className="draft-head"><span><CheckIcon/> Draft ready</span><small>Not submitted</small></div><div className="draft-fields"><label>Attendance<input type="number" value={draft.attendance ?? ""} onChange={(e) => setDraft({ ...draft, attendance: e.target.value ? Number(e.target.value) : null })}/></label><label>Duration<input type="number" value={draft.duration_periods ?? ""} onChange={(e) => setDraft({ ...draft, duration_periods: e.target.value ? Number(e.target.value) : null })}/></label><label>Preferred room<input value={draft.requested_room ?? "Any suitable room"} onChange={(e) => setDraft({ ...draft, requested_room: e.target.value })}/></label><label>Needs<input value={draft.needs.join(", ")} onChange={(e) => setDraft({ ...draft, needs: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}/></label><label>Request title<input value={bookingTitle} onChange={e=>setBookingTitle(e.target.value)}/></label><label>Category<select value={bookingCategory} onChange={e=>setBookingCategory(e.target.value)}><option value="club_event">Club event</option><option value="department_event">Department event</option><option value="guest_lecture">Guest lecture</option><option value="institute_event">Institute event</option></select></label></div><label className="draft-schedule">Approved schedule ID<input value={bookingSchedule} onChange={e=>setBookingSchedule(e.target.value.trim())} placeholder="Schedule UUID"/></label>{draft.follow_up && <p className="follow-up">Needs clarification: {draft.follow_up}</p>}<button type="button" className="primary wide" disabled={busy||!bookingSchedule||!!draft.follow_up} onClick={submitDraft}>Submit for deterministic review <ArrowIcon/></button></div>}</article>
    </section>
    <section className="trust-strip"><span><CheckIcon/> AI never approves a booking</span><span><CheckIcon/> Every proposal is code-validated</span><span><CheckIcon/> Admin approval required for changes</span></section>
  </main>;
}
