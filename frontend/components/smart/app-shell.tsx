"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { BriefcaseIcon, CalendarIcon, CheckIcon, DatabaseIcon, GridIcon, MenuIcon, SparkIcon, WrenchIcon } from "../ui/icons";
import { NextGuide } from "./next-guide";
import { VoiceAssistant } from "./voice-assistant";

const links = [
  { href: "/dashboard", label: "Workspace", icon: GridIcon },
  { href: "/datasets", label: "Data", icon: DatabaseIcon },
  { href: "/schedule", label: "Timetable", icon: CalendarIcon },
  { href: "/approvals", label: "Approvals", icon: CheckIcon },
  { href: "/bookings", label: "Venues", icon: SparkIcon },
  { href: "/repair", label: "Changes", icon: WrenchIcon },
  { href: "/manual", label: "Events", icon: CalendarIcon },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon },
];

const publicPaths = new Set(["/", "/login"]);

type Profile = { display_name: string; email: string; role: string; department: string | null };

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedName, setSavedName] = useState("CIT user");
  const [savedRole, setSavedRole] = useState("admin");
  useEffect(() => {
    if (process.env.NODE_ENV === "production") navigator.serviceWorker?.register("/sw.js");
    else navigator.serviceWorker?.getRegistrations().then((items) => items.forEach((item) => item.unregister()));
    if (!publicPaths.has(path)) {
      setSavedRole(localStorage.getItem("tz_role") ?? "admin");
      setSavedName(localStorage.getItem("tz_name") ?? "CIT user");
      if (!localStorage.getItem("tz_access_token")) router.replace("/login");
    }
  }, [path, router]);
  useEffect(() => {
    if (publicPaths.has(path) || !localStorage.getItem("tz_access_token")) return;
    api<Profile>("/api/v1/auth/me").then((result) => {
      if (result.data) {
        setProfile(result.data);
        localStorage.setItem("tz_role", result.data.role);
        localStorage.setItem("tz_name", result.data.display_name);
      }
    });
  }, [path]);
  if (publicPaths.has(path)) return <>{children}</>;
  const role = (profile?.role ?? savedRole).replaceAll("_", " ");
  const name = profile?.display_name ?? savedName;
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="app-layout">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" href="/dashboard" onClick={() => setOpen(false)}><span className="mark">C</span><span><b>TechZephyr</b><small>CIT scheduling</small></span></Link>
        <p className="side-kicker">Campus</p>
        <nav aria-label="Primary navigation">{links.map(({ href, label, icon: NavIcon }) => <Link className={path === href ? "active" : ""} href={href} key={href} onClick={() => setOpen(false)}><NavIcon /><span>{label}</span></Link>)}</nav>
        <div className="sidebar-foot">
          <Link href="/profile" onClick={() => setOpen(false)} className="who">
            <span className="avatar">{initials}</span>
            <div><strong>{name}</strong><small>{role}</small></div>
          </Link>
          <button onClick={() => { const refreshToken = localStorage.getItem("tz_refresh_token"); if (refreshToken) void api("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }); localStorage.clear(); router.push("/"); }} aria-label="Sign out">↗</button>
        </div>
      </aside>
      <div className="app-content">
        <div className="mobile-bar"><button onClick={() => setOpen(!open)} aria-label="Toggle menu"><MenuIcon /></button><span>CIT Campus</span><Link href="/profile">Profile</Link></div>
        <NextGuide path={path} />
        {children}
        <VoiceAssistant />
      </div>
    </div>
  );
}
