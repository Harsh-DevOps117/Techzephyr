"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Reveal } from "../components/motion/reveal";

const rows: { text: string; kind?: "lab" | "exam" }[][] = [
  [{ text: "MA101" }, { text: "CS201" }, { text: "PH101" }, { text: "" }, { text: "HS101" }],
  [{ text: "" }, { text: "CS201", kind: "lab" }, { text: "" }, { text: "EE201" }, { text: "" }],
  [{ text: "HS101" }, { text: "" }, { text: "MA101" }, { text: "" }, { text: "CS101" }],
  [{ text: "EE201" }, { text: "MA101" }, { text: "" }, { text: "PH101", kind: "exam" }, { text: "CS201" }],
  [{ text: "" }, { text: "" }, { text: "HS101" }, { text: "CS201", kind: "lab" }, { text: "" }],
];

const marks = ["Validator", "Two admins", "Card pickers", "Hinglish drafts", "Zero hard conflicts"];

export default function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(Boolean(localStorage.getItem("tz_access_token")));
  }, []);
  const enter = signedIn ? "/dashboard" : "/login";

  return (
    <div className="site">
      <div className="site-announce">
        <span>A different admin publishes the week. The creator cannot approve their own proposal.</span>
        <a href="#roles">Learn more</a>
      </div>
      <header className="site-nav">
        <Link href="/" className="site-mark">TechZephyr</Link>
        <nav>
          <a href="#product">Product</a>
          <a href="#week">The week</a>
          <a href="#roles">Roles</a>
        </nav>
        <div className="site-nav-actions">
          <Link href="/login" className="site-text">Log in</Link>
          <Link href={enter} className="site-btn">Open workspace</Link>
        </div>
      </header>

      <section className="site-hero">
        <p className="site-kicker">Chilika Institute of Technology</p>
        <h1>The campus week,<br />without a double booking.</h1>
        <p className="site-lead">Lectures, labs, midsems and Spectra requests share one timetable. People pick a card. The rules decide if it fits.</p>
        <div className="site-actions">
          <Link href={enter} className="site-btn">Open workspace</Link>
          <a href="#week" className="site-text">How a week is made</a>
        </div>
        <div className="site-stage">
          <figure className="site-console">
            <figcaption>
              <span>Workspace</span>
              <span className="site-chip">Frame, not live data</span>
            </figcaption>
            <div className="site-grid" aria-hidden="true">
              <div className="site-grid-head"><span /><b>Mon</b><b>Tue</b><b>Wed</b><b>Thu</b><b>Fri</b></div>
              {rows.map((row, index) => (
                <div className="site-grid-row" key={index}>
                  <span>P{index + 2}</span>
                  {row.map((cell, cellIndex) => (
                    <i key={cellIndex} className={cell.text ? `filled ${cell.kind ?? ""}` : ""}>{cell.text}</i>
                  ))}
                </div>
              ))}
            </div>
            <div className="site-console-foot">
              <span><b>0</b> hard conflicts</span>
              <span><b>2</b> admins to publish</span>
              <span><b>0</b> ids to paste</span>
            </div>
          </figure>
          <div className="site-stack">
            <aside className="site-aside">
              <p className="site-kicker">Public dataset</p>
              <h2>cit_public.json</h2>
              <ol>
                <li><span>Rooms</span><b>27</b></li>
                <li><span>Faculty</span><b>40</b></li>
                <li><span>Sessions</span><b>189</b></li>
                <li><span>Exams</span><b>41</b></li>
              </ol>
            </aside>
            <aside className="site-decision">
              <p className="site-kicker light">Spectra</p>
              <h3>Thursday evening</h3>
              <p>If the hall is held, the result is an alternative or a rejection. The reason is written down.</p>
              <span className="site-chip coral">Reason required</span>
            </aside>
          </div>
        </div>
      </section>

      <section className="site-trust" aria-label="What the product stands on">
        <p>Checked by the official validator. Published by a second admin.</p>
        <ul>
          {marks.map((mark) => <li key={mark}>{mark}</li>)}
        </ul>
      </section>

      <Reveal>
        <section className="site-capabilities" id="product">
          <div className="site-band">
            <p className="site-kicker light">Product</p>
            <h2>Four jobs. One published week.</h2>
            <div className="site-cap-grid">
              <article><span>01</span><h3>Timetable</h3><p>Every lecture, tutorial and lab is placed once.</p></article>
              <article><span>02</span><h3>Exams</h3><p>Midsems use the following week. Room capacity is halved.</p></article>
              <article><span>03</span><h3>Spectra</h3><p>English or Hinglish becomes an editable draft.</p></article>
              <article><span>04</span><h3>Repair</h3><p>A leave or a closed room moves as few sessions as possible.</p></article>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="site-products" id="week">
          <p className="site-kicker">The week</p>
          <h2>Start from the file. End with a reason.</h2>
          <div className="site-product-grid">
            <article className="site-product-lead">
              <span className="site-chip coral">01 Data</span>
              <h3>Import the file. Pick the card.</h3>
              <p>Rooms, faculty, sessions and exams appear by name. The timetable is generated from that card. Nobody pastes an identifier.</p>
            </article>
            <article>
              <span className="site-chip coral">02 Approval</span>
              <h3>One signature is not enough.</h3>
              <p>A validated proposal waits. A different admin publishes it.</p>
            </article>
            <article>
              <span className="site-chip coral">03 Venues</span>
              <h3>Plain language in. A reason out.</h3>
              <p>The assistant drafts the request. It cannot approve it.</p>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="site-research" id="roles">
          <div className="site-research-head">
            <p className="site-kicker">Roles</p>
            <h2>Four accounts. The same approval rule.</h2>
          </div>
          <div className="site-research-row site-research-label"><span>Role</span><span>What they do</span><span>What they never do</span></div>
          <div className="site-research-row"><h3>Admin</h3><p>Imports data and generates the week.</p><p>Cannot approve their own proposal.</p></div>
          <div className="site-research-row"><h3>Reviewer</h3><p>The second admin. Publishes the week.</p><p>Cannot approve a week they created.</p></div>
          <div className="site-research-row"><h3>Faculty</h3><p>Reads the week and describes a leave.</p><p>Cannot publish the change.</p></div>
          <div className="site-research-row"><h3>Clubs</h3><p>Submits a venue request and reads the reason.</p><p>Cannot approve the booking.</p></div>
        </section>
      </Reveal>

      <section className="site-close">
        <div>
          <p className="site-kicker light">Workspace</p>
          <h2>Open the week.</h2>
          <p>Each screen names the next click. Cards carry the names.</p>
          <Link href={enter} className="site-btn light">Enter the workspace</Link>
        </div>
        <ul>
          <li><b>189</b><span>sessions in the public file</span></li>
          <li><b>0</b><span>hard conflicts in a valid week</span></li>
          <li><b>2</b><span>admins before it is published</span></li>
        </ul>
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
