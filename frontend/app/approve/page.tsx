"use client";
import { useEffect, useState } from "react";
import { api, uuidv7 } from "../../lib/api";
import { CheckIcon } from "../../components/ui/icons";
import { Feedback, StepHeader } from "../../components/ui/feedback";
export default function Approve() {
  const [id, setId] = useState(""), [confirmed,setConfirmed]=useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  useEffect(()=>{const value=new URLSearchParams(window.location.search).get("id");if(value)setId(value);},[]);
  async function submit() { setBusy(true); setError(""); const r = await api<{ scheduleVersionId: string; status: string }>(`/api/v1/schedules/${id}/approve`, { method: "POST", headers: { "idempotency-key": uuidv7() }, body: "{}" }); setBusy(false); if (!r.data) { setError(r.error ?? "Approval failed"); return; } setMessage(`Schedule ${r.data.scheduleVersionId} is now ${r.data.status}.`); }
  return <main className="route"><StepHeader eyebrow="ADMIN · REVIEW" title="Approve a validated proposal" copy="Only code-validated schedules can be approved, and creators cannot approve their own proposal."/><section className="form-layout"><div className="form-card"><div className="section-title"><span className="card-icon mint"><CheckIcon/></span><div><h2>Proposal approval</h2><p>Sign in as reviewer@cit.local when the main Admin created it.</p></div></div><label>Schedule proposal ID<input value={id} onChange={(e) => setId(e.target.value.trim())} placeholder="Validated schedule UUID"/></label><label className="confirm-row"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I reviewed the changes and validation result.</span></label><button className="primary wide" onClick={submit} disabled={!id || !confirmed || busy}>{busy ? "Approving…" : "Approve proposal"}</button>{error && <Feedback tone="error" title="Could not approve">{error}</Feedback>}{message && <Feedback tone="success" title="Proposal approved">{message}</Feedback>}</div></section></main>;
}
