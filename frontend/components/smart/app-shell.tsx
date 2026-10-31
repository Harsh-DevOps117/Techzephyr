"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { ApprovalIcon, BriefcaseIcon, CalendarIcon, DatabaseIcon, EventIcon, GridIcon, LogoutIcon, PanelIcon, VenueIcon, WrenchIcon } from "../ui/icons";
import { NextGuide } from "./next-guide";
import { VoiceAssistant } from "./voice-assistant";
import { SmoothScroll } from "../motion/smooth-scroll";
import { PageTransition } from "../motion/page-transition";
import { canOpen, type Role } from "../../lib/access";

const links: { href: string; label: string; icon: typeof GridIcon; roles: Role[] }[] = [
  { href: "/dashboard", label: "Workspace", icon: GridIcon, roles: ["admin", "department_coordinator", "faculty", "club"] },
  { href: "/datasets", label: "Data", icon: DatabaseIcon, roles: ["admin", "department_coordinator", "faculty"] },
  { href: "/schedule", label: "Timetable", icon: CalendarIcon, roles: ["admin", "department_coordinator", "faculty", "club"] },
  { href: "/approvals", label: "Approvals", icon: ApprovalIcon, roles: ["admin"] },
  { href: "/bookings", label: "Venues", icon: VenueIcon, roles: ["admin", "department_coordinator", "faculty", "club"] },
  { href: "/repair", label: "Changes", icon: WrenchIcon, roles: ["admin", "department_coordinator", "faculty"] },
  { href: "/manual", label: "Events", icon: EventIcon, roles: ["admin", "department_coordinator"] },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon, roles: ["admin", "department_coordinator", "faculty", "club"] },
];

const publicPaths = new Set(["/", "/login"]);

type Profile = { display_name: string; email: string; role: string; department: string | null };

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState<boolean | null>(null);
  function toggleNav() {
    const desktop = window.matchMedia("(min-width: 761px)").matches;
    setNavOpen((current) => !(current === null ? desktop : current));
  }
  function closeNavOnMobile() {
    if (window.matchMedia("(max-width: 760px)").matches) setNavOpen(false);
  }
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedName, setSavedName] = useState("CIT user");
  const [savedRole, setSavedRole] = useState("");
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
  if (publicPaths.has(path)) return <><SmoothScroll />{children}</>;
  const roleKey = profile?.role ?? savedRole;
  const role = (roleKey || "account").replaceAll("_", " ");
  const allowed = roleKey ? canOpen(roleKey, path) : true;
  const visible = links.filter((link) => !roleKey || link.roles.includes(roleKey as Role));
  const name = profile?.display_name ?? savedName;
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`app-layout${navOpen === false ? " nav-closed" : ""}${navOpen === true ? " nav-open" : ""}`}>
      <aside className={`sidebar ${navOpen === true ? "open" : ""}`}>
        <div className="brand-row">
          <Link className="brand" href="/dashboard" onClick={closeNavOnMobile}><span className="mark">C</span><span><b>TechZephyr</b><small>CIT scheduling</small></span></Link>
          <button type="button" className="nav-toggle" aria-expanded={navOpen !== false} aria-label="Hide navigation" onClick={toggleNav}><PanelIcon /></button>
        </div>
        <p className="side-kicker">Campus</p>
        <nav aria-label="Primary navigation">{visible.map(({ href, label, icon: NavIcon }) => <Link className={path === href ? "active" : ""} href={href} key={href} onClick={closeNavOnMobile}><NavIcon /><span>{label}</span></Link>)}</nav>
        <div className="sidebar-foot">
          <Link href="/profile" onClick={closeNavOnMobile} className="who">
            <span className="avatar">{initials}</span>
            <div><strong>{name}</strong><small>{role}</small></div>
          </Link>
          <button onClick={() => { const refreshToken = localStorage.getItem("tz_refresh_token"); if (refreshToken) void api("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }); localStorage.clear(); router.push("/"); }} aria-label="Sign out"><LogoutIcon /></button>
        </div>
      </aside>
      <div className="app-content">
        <div className="mobile-bar">
          <button type="button" className="nav-toggle" aria-expanded={navOpen === true} aria-label={navOpen === true ? "Hide navigation" : "Open navigation"} onClick={toggleNav}><PanelIcon /></button>
          <span>CIT Campus</span>
          <Link href="/profile">Profile</Link>
        </div>
        <NextGuide path={path} role={roleKey} />
        <PageTransition>
          {allowed ? children : (
            <main className="route">
              <p className="eyebrow">ACCESS</p>
              <h1>This role cannot open this screen.</h1>
              <p>Your account can use the pages listed in the sidebar. The API enforces the same limit.</p>
              <a className="primary" href="/dashboard" data-testid="forbidden">Back to workspace</a>
            </main>
          )}
        </PageTransition>
        <VoiceAssistant />
      </div>
    </div>
  );
}
