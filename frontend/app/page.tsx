"use client";
import { FormEvent, useState } from "react";
import { api } from "../lib/api";
const periods = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];
const sample = [{ course: "MA101 · Calculus", room: "LH-1", time: "09:00", tone: "blue" }, { course: "CS101 · Programming", room: "LAB-CS-1", time: "11:00", tone: "purple" }, { course: "PH101 · Physics", room: "AUD", time: "14:00", tone: "orange" }];

export default function Home() {
  const [request, setRequest] = useState("seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye");
  const [status, setStatus] = useState("Ready to parse a natural-language request.");
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  async function parse(event: FormEvent) {
    event.preventDefault(); setStatus("Reading request…");
    try {
      const response = await api<{draft:Record<string,unknown>}>("/api/v1/ai/booking-drafts", { method: "POST", body: JSON.stringify({ text: request }) });
      if (!response.data) throw new Error(response.error ?? "Unable to create draft");
      setDraft(response.data.draft); setStatus("Editable draft created. It still needs deterministic validation before submission.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Connection unavailable. Use the manual booking form."); }
  }
  return <main>
    <section className="hero"><div><p className="eyebrow">CHILIKA INSTITUTE OF TECHNOLOGY</p><h1>Make room for<br/><em>everything important.</em></h1><p className="lede">A calm, conflict-aware control room for timetables, exams, events, and last-minute changes.</p><div className="actions"><button className="primary">Generate timetable <span>→</span></button><button className="secondary">View conflicts</button></div></div><aside className="health"><p>WEEK 7 · SPECTRA</p><strong>93<span>%</span></strong><small>schedule health</small><div className="progress"><i/></div><ul><li><b>0</b> active hard conflicts</li><li><b>12</b> requests awaiting review</li></ul></aside></section>
    <section className="metrics" id="insights"><article><small>ROOM UTILISATION</small><strong>68%</strong><span>↑ 6% from last week</span></article><article><small>TEACHING SESSIONS</small><strong>189</strong><span>243 scheduled hours</span></article><article><small>APPROVAL QUEUE</small><strong>12</strong><span className="amber">4 need attention today</span></article></section>
    <section className="workspace" id="schedule"><div className="panel schedule"><div className="panel-head"><div><p className="eyebrow">LIVE VIEW</p><h2>Year 2 · CSE</h2></div><button>Week 7 ▾</button></div><div className="grid"><div className="hours">{periods.map((time) => <span key={time}>{time}</span>)}</div>{["MON", "TUE", "WED", "THU", "FRI"].map((day, index) => <div className="day" key={day}><b>{day}</b>{sample.slice(0, index % 3 + 1).map((item, i) => <div className={`class ${item.tone}`} key={item.course + i} style={{ top: `${36 + i * 76}px` }}><strong>{item.course}</strong><small>{item.room} · {item.time}</small></div>)}</div>)}</div><footer><span className="legend blue"/>Lecture <span className="legend purple"/>Lab <span className="legend orange"/>Tutorial</footer></div>
      <div className="panel assistant" id="requests"><p className="eyebrow">AI REQUEST ASSISTANT</p><h2>Turn a message into a booking.</h2><p>English or Hinglish works. You stay in control before anything is submitted.</p><form onSubmit={parse}><textarea value={request} onChange={(e) => setRequest(e.target.value)} aria-label="Booking request"/><button className="primary" type="submit">Create draft <span>→</span></button></form><p className="status">{status}</p>{draft && <pre>{JSON.stringify(draft, null, 2)}</pre>}</div></section>
  </main>;
}
