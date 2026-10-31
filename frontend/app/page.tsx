"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Reveal } from "../components/motion/reveal";

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
          <h1>The campus week, without a double booking.</h1>
          <p>Lectures, labs, midsems and Spectra requests share one timetable. People pick a card. The rules decide if it fits.</p>
          <div className="site-actions">
            <Link href={enter} className="site-btn">Open workspace</Link>
            <a href="#week" className="site-text">How a week is made</a>
          </div>
        </div>
        <figure className="site-frame">
          <figcaption><span>Workspace</span><span>Approved week</span></figcaption>
          <div className="site-grid" aria-hidden="true">
            <div className="site-grid-head"><span /><b>Mon</b><b>Tue</b><b>Wed</b><b>Thu</b><b>Fri</b></div>
            {rows.map((row, index) => (
              <div className="site-grid-row" key={index}>
                <span>P{index + 2}</span>
                {row.map((cell, cellIndex) => <i key={cellIndex} className={cell ? "filled" : ""}>{cell}</i>)}
              </div>
            ))}
          </div>
        </figure>
      </section>

      <Reveal>
        <section className="site-strip" id="product">
          <article><h2>Timetable</h2><p>Every lecture, tutorial and lab is placed once.</p></article>
          <article><h2>Exams</h2><p>Midsems use the following week. Room capacity is halved.</p></article>
          <article><h2>Spectra</h2><p>English or Hinglish becomes an editable draft.</p></article>
          <article><h2>Repair</h2><p>A leave or a closed room moves as few sessions as possible.</p></article>
        </section>
      </Reveal>

      <Reveal>
        <section className="site-story" id="week">
          <div className="site-story-copy">
            <p className="site-kicker">01 — Data</p>
            <h2>Start from the file.</h2>
            <p>Import cit_public.json. Rooms, faculty, sessions and exams appear as a card. Nobody pastes an identifier.</p>
          </div>
          <div className="site-panel">
            <header><span>Dataset</span><span>cit_public.json</span></header>
            <ol>
              <li><span>Rooms</span><b>27</b></li>
              <li><span>Faculty</span><b>40</b></li>
              <li><span>Sessions</span><b>189</b></li>
              <li><span>Exams</span><b>41</b></li>
            </ol>
            <p>Counts from the public CIT dataset, not a live total.</p>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="site-story flip">
          <div className="site-panel quiet">
            <header><span>Proposal</span><span>Second admin</span></header>
            <p className="site-panel-title">Weekly timetable</p>
            <p>The person who generated the week cannot approve it.</p>
          </div>
          <div className="site-story-copy">
            <p className="site-kicker">02 — Approval</p>
            <h2>One signature is not enough.</h2>
            <p>A validated proposal waits. A different admin publishes it. Until then it is not the campus week.</p>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="site-story">
          <div className="site-story-copy">
            <p className="site-kicker">03 — Venues</p>
            <h2>Plain language in. A reason out.</h2>
            <p>The assistant drafts attendance, time and needs. It cannot approve. Deterministic checks decide.</p>
          </div>
          <div className="site-panel">
            <header><span>Spectra</span><span>Decision</span></header>
            <p className="site-panel-title">Thursday evening</p>
            <p>If the requested hall is held, the result is an alternative or a rejection, and the reason is written down.</p>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="site-roles" id="roles">
          <div className="site-roles-head">
            <p className="site-kicker">Roles</p>
            <h2>Four accounts. The same approval rule.</h2>
          </div>
          <div>
            <article><h3>Admin</h3><p>Imports data, generates the week, approves someone else’s proposal.</p></article>
            <article><h3>Reviewer</h3><p>The second admin. Publishes the timetable the first admin created.</p></article>
            <article><h3>Faculty</h3><p>Reads their week and asks for a change when they are away.</p></article>
            <article><h3>Clubs</h3><p>Submit a venue request and read the status and the reason.</p></article>
          </div>
        </section>
      </Reveal>

      <section className="site-close">
        <h2>Open the week.</h2>
        <p>Each screen names the next click. Cards carry the names.</p>
        <Link href={enter} className="site-btn">Enter the workspace</Link>
      </section>

      <footer className="site-foot">
        <div><b>TechZephyr</b><span>Campus scheduling for Chilika Institute of Technology.</span></div>
        <nav>
          <Link href="/login">Log in</Link>
          <a href="#product">Product</a>
          <a href="#roles">Roles</a>
        </nav>
      </footer>
    </div>
  );
}
