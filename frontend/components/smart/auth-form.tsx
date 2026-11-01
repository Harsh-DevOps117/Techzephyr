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
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"sign-in" | "reset" | "confirm">("sign-in");
  const [demoCode, setDemoCode] = useState("");
  const [notice, setNotice] = useState("");
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

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const result = await api<{ demo?: boolean; demoCode?: string }>("/api/v1/auth/password-resets", {
      method: "POST",
      body: JSON.stringify({ email, phone }),
    });
    setBusy(false);
    if (!result.data) {
      setError(result.error ?? "Could not start the reset");
      return;
    }
    setDemoCode(result.data.demoCode ?? "");
    setNotice(result.data.demo ? "Twilio demo: no SMS was sent. Use the code below." : "Twilio sent a code to that phone. It expires in 10 minutes.");
    setMode("confirm");
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await api<{ reset: boolean }>("/api/v1/auth/password-resets/confirm", {
      method: "POST",
      body: JSON.stringify({ email, code, password }),
    });
    setBusy(false);
    if (!result.data) {
      setError(result.error ?? "Could not reset the password");
      return;
    }
    setNotice("Password updated. Sign in with the new one.");
    setPassword("");
    setCode("");
    setDemoCode("");
    setMode("sign-in");
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
      <form className="auth" onSubmit={mode === "sign-in" ? submit : mode === "reset" ? sendCode : savePassword}>
        <p className="eyebrow">CAMPUS OPERATIONS</p>
        <h2>{mode === "sign-in" ? "Welcome back" : "Reset password"}</h2>
        <p className="auth-copy">{mode === "sign-in" ? "Sign in with your campus account." : "Twilio sends a 6 digit code. In demo mode the code appears here."}</p>
        {mode === "sign-in" && demoAccounts.length > 0 && (
          <div className="account-pills">
            {demoAccounts.map(([label, value]) => (
              <button type="button" className={email === value ? "active" : ""} onClick={() => setEmail(value)} key={value}>{label}</button>
            ))}
          </div>
        )}
        <label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required /></label>
        {mode === "reset" && <label>Mobile number<input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" placeholder="+919876543210" autoComplete="tel" required /></label>}
        {mode === "confirm" && <label>Code<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" required /></label>}
        {mode !== "reset" && <label>{mode === "confirm" ? "New password" : "Password"}<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "confirm" ? "new-password" : "current-password"} minLength={mode === "confirm" ? 8 : undefined} required /></label>}
        {demoCode && <p className="demo-code">Twilio demo code <b>{demoCode}</b></p>}
        {notice && <p className="helper-text">{notice}</p>}
        {error && <p className="error">{error}</p>}
        <button className="primary auth-submit" disabled={busy}>{busy ? "Working…" : mode === "sign-in" ? "Enter workspace" : mode === "reset" ? "Send code" : "Save password"}<ArrowIcon /></button>
        {mode === "sign-in" ? (
          <button type="button" className="text-link reset-link" onClick={() => { setError(""); setNotice(""); setMode("reset"); }}>Reset password</button>
        ) : (
          <button type="button" className="text-link reset-link" onClick={() => { setError(""); setMode("sign-in"); }}>Back to sign in</button>
        )}
      </form>
    </div>
  );
}
