"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const rows = [
  ["MA101", "CS201", "PH101", "MA101", "HS101"],
  ["", "CS201 lab", "", "EE201", ""],
  ["HS101", "", "MA101", "", "CS101"],
];

export default function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(Boolean(localStorage.getItem("tz_access_token")));
  }, []);
  const enter = signedIn ? "/dashboard" : "/login";

  return (
    <div className="site">
      <header className="site-nav">
        <Link href="/" className="site-mark">TechZephyr</Link>
        <nav>
          <a href="#product">Product</a>
          <a href="#week">The week</a>
          <a href="#roles">Roles</a>
        </nav>
        <div className="site-nav-actions">
          <Link href="/login">Log in</Link>
          <Link href={enter} className="site-btn">Open workspace</Link>
        </div>
      </header>

      <section className="site-hero">
        <div className="site-copy">
          <p className="site-kicker">Chilika Institute of Technology</p>
          <h1>One week.<br />No double-booked rooms.</h1>
          <p>Lectures, labs, midsems and Spectra requests share one timetable. People choose a card. The rules decide whether it fits.</p>
          <div className="site-actions">
            <Link href={enter} className="site-btn">Open workspace</Link>
            <a href="#week" className="site-text">See how a week is made</a>
          </div>
        </div>
        <figure className="site-frame">
          <figcaption>
            <span>Workspace</span>
            <span>Approved week</span>
          </figcaption>
          <div className="site-grid" aria-hidden="true">
            <div className="site-grid-head"><span /><b>Mon</b><b>Tue</b><b>Wed</b><b>Thu</b><b>Fri</b></div>
            {rows.map((row, index) => (
              <div className="site-grid-row" key={days[index]}>
                <span>P{index + 2}</span>
                {row.map((cell, cellIndex) => <i key={`${index}-${cellIndex}`} className={cell ? "filled" : ""}>{cell}</i>)}
              </div>
            ))}
          </div>
          <ul>
            <li><b>0</b> hard conflicts on a validated proposal</li>
            <li><b>Reason</b> attached to every venue decision</li>
          </ul>
        </figure>
      </section>

      <section className="site-strip" id="product">
        <article><h2>Timetable</h2><p>Every lecture, tutorial and lab placed once, without a clash.</p></article>
        <article><h2>Exams</h2><p>Midsems the following week. Rooms count at half capacity.</p></article>
        <article><h2>Spectra</h2><p>English or Hinglish requests become a draft you can edit.</p></article>
        <article><h2>Repair</h2><p>A leave or a closed room moves as few sessions as possible.</p></article>
      </section>

      <section className="site-story" id="week">
        <div className="site-story-copy">
          <p className="site-kicker">01 — Data</p>
          <h2>Start from the file, not a blank form.</h2>
          <p>Import cit_public.json. The dataset appears as a card: rooms, faculty, sessions, exams. Nobody pastes an identifier.</p>
        </div>
        <div className="site-panel">
          <header><span>Dataset</span><span>cit_public.json</span></header>
          <ol>
            <li><span>Rooms</span><b>27</b></li>
            <li><span>Faculty</span><b>40</b></li>
            <li><span>Sessions</span><b>189</b></li>
            <li><span>Exams</span><b>41</b></li>
          </ol>
          <p>These counts are the public CIT dataset, not a live campus total.</p>
        </div>
      </section>

      <section className="site-story flip">
        <div className="site-panel quiet">
          <header><span>Proposal</span><span>Awaiting a second admin</span></header>
          <p className="site-panel-title">Weekly timetable</p>
          <p>The person who generated the week cannot approve it. Reviewer opens the proposal, confirms the validation, and publishes.</p>
        </div>
        <div className="site-story-copy">
          <p className="site-kicker">02 — Approval</p>
          <h2>Nothing goes live on one signature.</h2>
          <p>A validated proposal waits. A different admin approves it. Until then it is a draft, not the campus week.</p>
        </div>
      </section>

      <section className="site-story">
        <div className="site-story-copy">
          <p className="site-kicker">03 — Venues</p>
          <h2>A request in plain language. A reason in return.</h2>
          <p>Clubs and departments describe a room. The assistant drafts attendance, time and needs. Deterministic checks approve, move, or reject it.</p>
        </div>
        <div className="site-panel">
          <header><span>Spectra</span><span>Decision</span></header>
          <p className="site-panel-title">Stage play, Thursday evening</p>
          <p>Seminar Hall 1 is already held. The nearest valid room is the auditorium, outside the requested window, so the status is an alternative — with the reason written out.</p>
        </div>
      </section>

      <section className="site-roles" id="roles">
        <div className="site-roles-head">
          <p className="site-kicker">Who uses it</p>
          <h2>Four roles. One rule about approval.</h2>
        </div>
        <div>
          <article><h3>Admin</h3><p>Imports the dataset, generates the week, and approves someone else’s proposal.</p></article>
          <article><h3>Reviewer</h3><p>The second admin. Publishes the timetable the first admin created.</p></article>
          <article><h3>Faculty</h3><p>Reads their own week and asks for a change when they are away.</p></article>
          <article><h3>Clubs</h3><p>Submit a venue request and read the status and the reason.</p></article>
        </div>
      </section>

      <section className="site-close">
        <h2>Open the week.</h2>
        <p>The workspace tells you the next click. Cards carry the names. Identifiers stay in the request.</p>
        <Link href={enter} className="site-btn">Enter the workspace</Link>
      </section>

      <footer className="site-foot">
        <div>
          <b>TechZephyr</b>
          <span>Campus scheduling for Chilika Institute of Technology.</span>
        </div>
        <nav>
          <Link href="/login">Log in</Link>
          <a href="#product">Product</a>
          <a href="#roles">Roles</a>
        </nav>
      </footer>
    </div>
  );
}
