"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Job } from "../../lib/types";
import { jobCards, useApiList, type JobSummary } from "../../lib/catalog";
import { PickerCards } from "../../components/smart/picker-cards";
import { BriefcaseIcon } from "../../components/ui/icons";
import { Feedback, StepHeader } from "../../components/ui/feedback";

export default function Jobs() {
  const jobs = useApiList<JobSummary>("/api/v1/jobs");
  const [id, setId] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("id");
    if (value) setId(value);
  }, []);

  useEffect(() => {
    if (!id) {
      setJob(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setBusy(true);
      const response = await api<Job>(`/api/v1/jobs/${id}`);
      if (cancelled) return;
      setBusy(false);
      if (!response.data) {
        setError(response.error ?? "Job not found");
        setJob(null);
        return;
      }
      setError("");
      setJob(response.data);
    }
    void load();
    const timer = window.setInterval(() => {
      void load();
      jobs.reload();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id]);

  return (
    <main className="route">
      <StepHeader eyebrow="OPERATIONS" title="Track background work" copy="Choose a job to follow generation, repair, validation and booking decisions." />
      <section className="form-layout">
        <div className="form-card">
          <div className="section-title"><span className="card-icon coral"><BriefcaseIcon /></span><div><h2>Recent jobs</h2><p>Select a card. Status refreshes while work is still running.</p></div></div>
          <PickerCards
            label="Job"
            hint={busy && id ? "Refreshing the selected job" : "Newest work appears first"}
            items={jobCards(jobs.items)}
            selectedId={id}
            onSelect={setId}
            loading={jobs.loading}
            error={jobs.error}
            empty="No background work yet. Generate a timetable or decide venue requests to see jobs here."
          />
          {error && <Feedback tone="error" title="Could not load job">{error}</Feedback>}
          {job && (
            <div className="job-card">
              <div className="job-top"><span className={`job-status ${job.status}`}>{job.status.replaceAll("_", " ")}</span></div>
              <h3>{job.type.replaceAll("_", " ")}</h3>
              <div className="job-meta">
                <div><span>Attempts</span><strong>{job.attempt_count}</strong></div>
                <div><span>Priority</span><strong>{job.priority}</strong></div>
                <div><span>Created</span><strong>{new Date(job.created_at).toLocaleString()}</strong></div>
              </div>
              {job.error && <Feedback tone="error" title="The operation failed">{job.error}</Feedback>}
            </div>
          )}
        </div>
        <aside className="info-card">
          <p className="eyebrow">JOB STATES</p>
          <div className="status-guide">
            <span><i className="queued" /><b>Queued</b> Waiting for a worker</span>
            <span><i className="running" /><b>Running</b> Work in progress</span>
            <span><i className="succeeded" /><b>Succeeded</b> Result is ready</span>
            <span><i className="failed" /><b>Failed</b> Review the explanation</span>
          </div>
        </aside>
      </section>
    </main>
  );
}
