"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { ArrowIcon, CheckIcon } from "../ui/icons";
const accounts = [
  ["Admin", "admin@cit.local"], ["Reviewer", "reviewer@cit.local"], ["Coordinator", "coordinator.cse@cit.local"], ["Faculty", "faculty.cse@cit.local"], ["Club", "club@cit.local"],
];
export function AuthForm() {
  const [email, setEmail] = useState("admin@cit.local"), [password, setPassword] = useState("TechZephyr!2026"), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: FormEvent) { e.preventDefault(); setError(""); setBusy(true); const r = await api<{ accessToken: string; refreshToken: string; role: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); setBusy(false); if (!r.data) { setError(r.error ?? "Unable to sign in"); return; } localStorage.setItem("tz_access_token", r.data.accessToken); localStorage.setItem("tz_refresh_token", r.data.refreshToken); localStorage.setItem("tz_role", r.data.role); router.replace("/"); }
  return <div className="login-wrap"><section className="login-story"><div className="login-brand"><span className="mark">C</span> Chilika Institute of Technology</div><div><p className="eyebrow">ONE CAMPUS · ONE CLEAR SCHEDULE</p><h1>Every class, exam and event. <em>One calm plan.</em></h1><p>Conflict-free campus scheduling with decisions your team can understand and trust.</p></div><ul><li><CheckIcon/> Code-validated schedules</li><li><CheckIcon/> Role-based approvals</li><li><CheckIcon/> English + Hinglish requests</li></ul></section><form className="auth" onSubmit={submit}><p className="eyebrow">CAMPUS OPERATIONS</p><h2>Welcome back</h2><p className="auth-copy">Choose a demo role or sign in with your CIT account.</p><div className="account-pills">{accounts.map(([label, value]) => <button type="button" className={email === value ? "active" : ""} onClick={() => setEmail(value)} key={value}>{label}</button>)}</div><label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label><label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /></label>{error && <p className="error">{error}</p>}<button className="primary auth-submit" disabled={busy}>{busy ? "Signing in…" : "Enter workspace"}<ArrowIcon/></button><small className="demo-note">Demo password: <b>TechZephyr!2026</b></small></form></div>;
}
