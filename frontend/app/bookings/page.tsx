"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, uuidv7 } from "../../lib/api";
import { scheduleCards, useApiList, type ScheduleSummary } from "../../lib/catalog";
import { PickerCards } from "../../components/smart/picker-cards";
import { SparkIcon } from "../../components/ui/icons";
import { Feedback, StepHeader } from "../../components/ui/feedback";

const priority = ["Exams", "Regular classes", "Institute events", "Guest lectures", "Department events", "Club events"];

type VenueRequest = {
  id: string;
  title: string;
  requested_category: string;
  status: string;
  created_at: string;
  proposed_decision: { status: string; reason: string; day?: string; start_period?: number; end_period?: number; room_id?: string };
};

export default function Bookings() {
  const schedules = useApiList<ScheduleSummary>("/api/v1/schedules");
  const usable = schedules.items.filter((item) => item.status === "approved" || item.status === "pending_admin_approval" || item.status === "validated");
  const [schedule, setSchedule] = useState("");
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState("");
  const [error, setError] = useState("");
  const [requests, setRequests] = useState<VenueRequest[]>([]);

  async function loadRequests() {
    const response = await api<{ items: VenueRequest[] }>("/api/v1/booking-requests");
    if (response.data) setRequests(response.data.items);
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function decide() {
    setBusy(true);
    setError("");
    const response = await api<{ jobId: string }>("/api/v1/bookings/decide", {
      method: "POST",
      headers: { "idempotency-key": uuidv7() },
      body: JSON.stringify({ scheduleVersionId: schedule }),
    });
    setBusy(false);
    if (!response.data) {
      setError(response.error ?? "Could not start booking decisions");
      return;
    }
    setJob(response.data.jobId);
  }

  async function review(id: string) {
    setBusy(true);
    const response = await api<{ status: string }>(`/api/v1/booking-requests/${id}/review`, { method: "POST", body: "{}" });
    setBusy(false);
    if (!response.data) {
      setError(response.error ?? "Review failed");
      return;
    }
    await loadRequests();
  }

  return (
    <main className="route">
      <StepHeader eyebrow="SPECTRA · VENUE REQUESTS" title="Decide bookings by rule, not guesswork" copy="Approve, reject or offer an alternative for every request, with a human-readable reason." />
      <section className="form-layout">
        <div className="form-card">
          <div className="section-title"><span className="card-icon mint"><SparkIcon /></span><div><h2>Run dataset decisions</h2><p>Choose a validated timetable so classes remain protected.</p></div></div>
          <PickerCards
            label="Timetable"
            hint="Spectra requests from the CIT dataset are decided against this timetable"
            items={scheduleCards(usable)}
            selectedId={schedule}
            onSelect={setSchedule}
            loading={schedules.loading}
            error={schedules.error}
            empty="Generate a timetable before deciding venue requests."
          />
          <div className="decision-preview">
            <div><span className="status-dot approved" />Approved <b>Venue and time fit</b></div>
            <div><span className="status-dot alternative" />Alternative <b>Best valid nearby option</b></div>
            <div><span className="status-dot rejected" />Rejected <b>Clear conflict reason</b></div>
          </div>
          <button className="primary wide" disabled={busy || !schedule} onClick={decide}>{busy ? "Checking requests…" : "Re-evaluate Spectra requests"}</button>
          {error && <Feedback tone="error" title="Booking workflow needs attention">{error}</Feedback>}
          {job && <Feedback tone="success" title="Decision job queued">Follow it in <Link href={`/jobs?id=${job}`}>Operations</Link>.</Feedback>}
        </div>
        <aside className="info-card">
          <p className="eyebrow">CONFLICT PRIORITY</p>
          <ol className="priority-list">{priority.map((item, index) => <li key={item}><b>{index + 1}</b><span>{item}</span></li>)}</ol>
          <p className="rule-note">A requester’s role caps the category they can claim. Earlier submission breaks ties. Nobody approves their own request.</p>
        </aside>
      </section>
      <section className="form-card request-review">
        <div className="panel-title"><div><p className="eyebrow">NATURAL-LANGUAGE SUBMISSIONS</p><h2>Review deterministic proposals</h2></div></div>
        {requests.length === 0 ? (
          <div className="empty-state"><span>✓</span><h2>No submitted requests</h2><p>Editable drafts submitted from the dashboard appear here.</p></div>
        ) : (
          <div className="approval-list">
            {requests.map((request) => (
              <article key={request.id}>
                <div>
                  <span className={`job-status ${request.status === "approved" ? "succeeded" : ""}`}>{request.status.replaceAll("_", " ")}</span>
                  <h3>{request.title}</h3>
                  <p>{request.requested_category.replaceAll("_", " ")} · {new Date(request.created_at).toLocaleString()}</p>
                  <small>{request.proposed_decision.reason}</small>
                </div>
                <div className="approval-metrics">
                  <span><b>{request.proposed_decision.status.replaceAll("_", " ")}</b> proposal</span>
                  {request.proposed_decision.room_id && <span><b>{request.proposed_decision.room_id}</b>{request.proposed_decision.day} P{request.proposed_decision.start_period}</span>}
                </div>
                {request.status === "pending_review" && <button className="primary" onClick={() => review(request.id)} disabled={busy}>Apply reviewed decision</button>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
