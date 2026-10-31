"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

type Profile = {
  email: string;
  display_name: string;
  role: string;
  department: string | null;
};

const roleNotes: Record<string, { title: string; points: string[]; next: string; href: string }> = {
  admin: {
    title: "Dean’s office",
    points: ["Import the dataset and generate the week.", "Approve timetable changes, but never your own proposal.", "Reset demo data when judges need a clean start."],
    next: "Open the workspace",
    href: "/dashboard",
  },
  department_coordinator: {
    title: "Department coordinator",
    points: ["Ask for changes to your department’s sessions.", "Book rooms for department events.", "Approve bookings that use your department’s labs."],
    next: "Plan a change",
    href: "/repair",
  },
  faculty: {
    title: "Faculty",
    points: ["Read the timetable filtered to your name.", "Describe a leave or a moved session.", "You cannot publish a change by yourself."],
    next: "See the timetable",
    href: "/schedule",
  },
  club: {
    title: "Club representative",
    points: ["Submit a venue request in English or Hinglish.", "Cancel your own request.", "Read the status and the reason. You do not approve it."],
    next: "Ask for a room",
    href: "/bookings",
  },
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Profile>("/api/v1/auth/me").then((result) => {
      if (!result.data) {
        setError(result.error ?? "Could not load your profile");
        return;
      }
      setProfile(result.data);
    });
  }, []);
  const note = roleNotes[profile?.role ?? ""] ?? roleNotes.admin;
  const initials = (profile?.display_name ?? "CIT").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return (
    <main className="route profile-page">
      <p className="chip">Your profile</p>
      <h1>{profile?.display_name ?? "Loading your name…"}</h1>
      <p className="lede">{profile ? `${profile.email}${profile.department ? ` · ${profile.department}` : ""}` : "Fetching the signed-in campus account."}</p>
      {error && <p className="error">{error}</p>}
      <section className="profile-grid">
        <article className="identity-card">
          <span className="avatar big">{initials}</span>
          <div>
            <small>Signed in as</small>
            <strong>{(profile?.role ?? "campus").replaceAll("_", " ")}</strong>
            <p>{note.title}</p>
          </div>
          <button className="ghost" onClick={() => { const refreshToken = localStorage.getItem("tz_refresh_token"); if (refreshToken) void api("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }); localStorage.clear(); router.push("/"); }}>Sign out</button>
        </article>
        <article className="note-card">
          <b>What you can do</b>
          <ul>{note.points.map((point) => <li key={point}>{point}</li>)}</ul>
          <Link href={note.href} className="primary">{note.next}</Link>
        </article>
        <article className="note-card">
          <b>What you never type</b>
          <p>Schedules, rooms, groups and jobs are cards. Click the one with the name you recognise.</p>
          <Link href="/dashboard" className="text-link">Back to the four steps</Link>
        </article>
      </section>
    </main>
  );
}
