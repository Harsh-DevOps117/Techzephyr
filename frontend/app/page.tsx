"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(Boolean(localStorage.getItem("tz_access_token")));
  }, []);
  const enter = signedIn ? "/dashboard" : "/login";
  return (
    <div className="landing">
      <header className="land-nav">
        <Link href="/" className="land-logo"><span>C</span> TechZephyr</Link>
        <nav>
          <a href="#how">How it works</a>
          <a href="#roles">Who it’s for</a>
          <a href="#week">The week</a>
        </nav>
        <div className="land-nav-actions">
          <Link href="/login" className="ghost">Log in</Link>
          <Link href={enter} className="pill">Open workspace</Link>
        </div>
      </header>

      <section className="hero">
        <p className="chip">Chilika Institute of Technology · one campus week</p>
        <h1>Never double-book a room again.</h1>
        <p className="lede">Classes, midsems and Spectra week live in one timetable. You click a card. The rules decide if it fits.</p>
        <div className="hero-actions">
          <Link href={enter} className="pill">Open workspace</Link>
          <a href="#how" className="ghost">See the four steps</a>
        </div>
        <p className="backed">Demo roles are ready · admin, reviewer, coordinator, faculty, club</p>
        <div className="hero-stage" aria-hidden="true">
          <div className="blob yellow" />
          <div className="blob pink" />
          <article className="paper-card">
            <h2>Week 7 · CIT</h2>
            <p><b>Objective:</b> keep every lecture, lab and Spectra booking in a room that is actually free.</p>
            <p><b>Monday:</b> MA101 in Lecture Hall 1, then CS101 lab.</p>
            <p><b>Spectra:</b> auditorium held for the institute event. The club request moves.</p>
          </article>
          <div className="crowd">
            <i className="person p1" /><i className="person p2" /><i className="person p3" /><i className="person p4" />
          </div>
        </div>
      </section>

      <section className="feature-bar" id="week">
        <article><b>Timetable</b><span>Every lecture, tutorial and lab, with no clashes.</span></article>
        <article><b>Exams</b><span>Midsems the week after, rooms at half capacity.</span></article>
        <article><b>Spectra</b><span>Venue requests in English or Hinglish, with a reason.</span></article>
        <article><b>Repairs</b><span>A faculty leave or closed room moves as few classes as possible.</span></article>
        <article><b>Approval</b><span>Nothing goes live until a different admin says yes.</span></article>
      </section>

      <section className="how" id="how">
        <h2>Four clicks. Then the week is real.</h2>
        <div className="how-row">
          <article>
            <span>1</span>
            <h3>Import</h3>
            <p>Drop in cit_public.json. A card appears. You never copy an id.</p>
          </article>
          <em>→</em>
          <article>
            <span>2</span>
            <h3>Generate</h3>
            <p>Click that dataset card. The solver places every session.</p>
          </article>
          <em>→</em>
          <article>
            <span>3</span>
            <h3>Approve</h3>
            <p>A second admin reviews the proposal. Creators cannot approve themselves.</p>
          </article>
          <em>→</em>
          <article>
            <span>4</span>
            <h3>Use it</h3>
            <p>Open a group, faculty or room. Decide Spectra requests on top.</p>
          </article>
        </div>
      </section>

      <section className="split">
        <article className="yellow-note">
          <p className="chip dark">Workspace</p>
          <h2>One app for the whole week.</h2>
          <p>A yellow bar on every screen says what to click next, and a green button takes you there.</p>
          <p className="fine">Replaces the spreadsheet, the WhatsApp room chase, and guessing which id to paste.</p>
        </article>
        <article className="mock-board">
          <header><b>Approved week</b><small>0 hard conflicts</small></header>
          <div className="mock-grid">
            <span>MON · P3</span><strong>CS101</strong><em>Classroom A-101</em>
            <span>MON · P5</span><strong>MA101</strong><em>Lecture Hall 2</em>
            <span>TUE · P2</span><strong>CS101 lab</strong><em>Computer lab</em>
          </div>
        </article>
      </section>

      <section className="roles" id="roles">
        <div className="role-board">
          <h2>Designed for the people who actually touch the week.</h2>
          <div className="stickies">
            <article className="sticky yellow"><b>Admin</b><p>Import the data, generate the week, and approve someone else’s proposal.</p></article>
            <article className="sticky pink"><b>Reviewer</b><p>The second admin. You approve the timetable the first admin created.</p></article>
            <article className="sticky blue"><b>Faculty</b><p>See your own week and ask for a change when you are away.</p></article>
            <article className="sticky mint"><b>Clubs</b><p>Ask for a room in plain language and read why it was approved or moved.</p></article>
          </div>
        </div>
      </section>

      <section className="quote">
        <p>“I can see the room, the reason, and the next button. I don’t have to ask anyone for an id.”</p>
        <small>Campus operations · Chilika Institute of Technology</small>
      </section>

      <footer className="land-foot">
        <div><b>TechZephyr</b><span>CIT campus scheduling</span></div>
        <Link href={enter} className="pill">Enter the workspace</Link>
      </footer>
    </div>
  );
}
