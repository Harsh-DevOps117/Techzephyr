"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { ArrowIcon, CheckIcon } from "../ui/icons";

const demoAccounts = process.env.NEXT_PUBLIC_DEMO_ACCOUNTS === "true"
  ? [
      ["Admin", "admin@cit.local"],
      ["Reviewer", "reviewer@cit.local"],
      ["Coordinator", "coordinator.cse@cit.local"],
      ["Faculty", "faculty.cse@cit.local"],
      ["Club", "club@cit.local"],
    ]
  : [];

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await api<{ accessToken: string; refreshToken: string; role: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (!result.data) {
      setError(result.error ?? "Unable to sign in");
      return;
    }
    localStorage.setItem("tz_access_token", result.data.accessToken);
    localStorage.setItem("tz_refresh_token", result.data.refreshToken);
    localStorage.setItem("tz_role", result.data.role);
    const me = await api<{ display_name: string; role: string }>("/api/v1/auth/me");
    if (me.data) {
      localStorage.setItem("tz_name", me.data.display_name);
      localStorage.setItem("tz_role", me.data.role);
    }
    router.replace("/dashboard");
  }

  return (
    <div className="login-wrap">
      <section className="login-story">
        <div className="login-brand"><span className="mark">C</span> Chilika Institute of Technology</div>
        <div>
          <p className="eyebrow">ONE CAMPUS · ONE CLEAR SCHEDULE</p>
          <h1>Every class, exam and event. <em>One calm plan.</em></h1>
          <p>Conflict-free campus scheduling with decisions your team can understand and trust.</p>
        </div>
        <ul>
          <li><CheckIcon /> Code-validated schedules</li>
          <li><CheckIcon /> Role-based approvals</li>
          <li><CheckIcon /> English and Hinglish requests</li>
        </ul>
      </section>
      <form className="auth" onSubmit={submit}>
        <p className="eyebrow">CAMPUS OPERATIONS</p>
        <h2>Welcome back</h2>
        <p className="auth-copy">Sign in with your campus account.</p>
        {demoAccounts.length > 0 && (
          <div className="account-pills">
            {demoAccounts.map(([label, value]) => (
              <button type="button" className={email === value ? "active" : ""} onClick={() => setEmail(value)} key={value}>{label}</button>
            ))}
          </div>
        )}
        <label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required /></label>
        <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary auth-submit" disabled={busy}>{busy ? "Signing in…" : "Enter workspace"}<ArrowIcon /></button>
      </form>
    </div>
  );
}
