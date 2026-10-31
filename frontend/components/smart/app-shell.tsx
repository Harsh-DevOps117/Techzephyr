"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BriefcaseIcon, CalendarIcon, CheckIcon, DatabaseIcon, GridIcon, MenuIcon, SparkIcon, WrenchIcon } from "../ui/icons";

const links = [
  { href: "/", label: "Overview", icon: GridIcon },
  { href: "/schedule", label: "Timetable", icon: CalendarIcon },
  { href: "/bookings", label: "Venue requests", icon: SparkIcon },
  { href: "/repair", label: "Schedule changes", icon: WrenchIcon },
  { href: "/manual", label: "Manual events", icon: CalendarIcon },
  { href: "/approvals", label: "Approvals", icon: CheckIcon },
  { href: "/datasets", label: "Data manager", icon: DatabaseIcon },
  { href: "/jobs", label: "Operations", icon: BriefcaseIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("Admin");
  useEffect(() => {
    setRole((localStorage.getItem("tz_role") ?? "admin").replaceAll("_", " "));
    if (process.env.NODE_ENV === "production") navigator.serviceWorker?.register("/sw.js");
    else navigator.serviceWorker?.getRegistrations().then((items) => items.forEach((item) => item.unregister()));
    if (path !== "/login" && !localStorage.getItem("tz_access_token")) router.replace("/login");
  }, [path, router]);
  if (path === "/login") return <>{children}</>;
  return <div className="app-layout">
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <Link className="brand" href="/" onClick={() => setOpen(false)}><span className="mark">C</span><span><b>CIT</b><small>Campus Operations</small></span></Link>
      <nav aria-label="Primary navigation">{links.map(({ href, label, icon: NavIcon }) => <Link className={path === href ? "active" : ""} href={href} key={href} onClick={() => setOpen(false)}><NavIcon/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-foot"><span className="avatar">CA</span><div><strong>CIT Admin</strong><small>{role}</small></div><button onClick={() => { localStorage.clear(); router.push("/login"); }} aria-label="Sign out">↗</button></div>
    </aside>
    <div className="app-content"><div className="mobile-bar"><button onClick={() => setOpen(!open)} aria-label="Toggle menu"><MenuIcon/></button><span>CIT Campus Operations</span><i/></div>{children}</div>
  </div>;
}
