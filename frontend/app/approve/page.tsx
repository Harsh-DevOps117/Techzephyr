"use client";

import { useEffect, useState } from "react";
import { api, uuidv7 } from "../../lib/api";
import { formatWhen } from "../../lib/catalog";
import { PickerCards, type PickerItem } from "../../components/smart/picker-cards";
import { CheckIcon } from "../../components/ui/icons";
import { Feedback, StepHeader } from "../../components/ui/feedback";

type Proposal = {
  id: string;
  baseline_schedule_id: string | null;
  validation_report: { hard_violation_count?: number; soft_total?: number; stability?: { sessions_moved?: number } } | null;
  created_at: string;
  created_by_name: string | null;
};

export default function Approve() {
  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [id, setId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("id");
    if (preset) setId(preset);
    api<{ items: Proposal[] }>("/api/v1/approvals").then((response) => {
      setLoading(false);
      if (!response.data) {
        setLoadError(response.error ?? "Could not load proposals");
        return;
      }
      setItems(response.data.items);
      if (preset && response.data.items.some((item) => item.id === preset)) setId(preset);
    });
  }, []);

  const cards: PickerItem[] = items.map((item) => ({
    id: item.id,
    title: item.baseline_schedule_id ? "Timetable repair" : "Generated timetable",
    status: "Awaiting approval",
    description: `Created by ${item.created_by_name ?? "a campus admin"} · ${formatWhen(item.created_at)}`,
    meta: `${item.validation_report?.hard_violation_count ?? 0} hard conflicts · soft penalty ${item.validation_report?.soft_total ?? 0}${item.baseline_schedule_id ? ` · ${item.validation_report?.stability?.sessions_moved ?? 0} moved` : ""}`,
  }));

  async function submit() {
    setBusy(true);
    setError("");
    const response = await api<{ scheduleVersionId: string; status: string }>(`/api/v1/schedules/${id}/approve`, {
      method: "POST",
      headers: { "idempotency-key": uuidv7() },
      body: "{}",
    });
    setBusy(false);
    if (!response.data) {
      setError(response.error ?? "Approval failed");
      return;
    }
    setMessage("This proposal is now the approved campus timetable.");
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <main className="route">
      <StepHeader eyebrow="ADMIN · REVIEW" title="Approve a validated proposal" copy="Only code-validated schedules can be approved, and creators cannot approve their own proposal." />
      <section className="form-layout">
        <div className="form-card">
          <div className="section-title"><span className="card-icon mint"><CheckIcon /></span><div><h2>Proposal approval</h2><p>Sign in as reviewer@cit.local when the main Admin created it.</p></div></div>
          <PickerCards
            label="Proposal"
            hint="Select the timetable you reviewed"
            items={cards}
            selectedId={id}
            onSelect={setId}
            loading={loading}
            error={loadError}
            empty="No validated proposals are waiting. Generate or repair a timetable first."
          />
          <label className="confirm-row">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>I reviewed the changes and validation result.</span>
          </label>
          <button className="primary wide" onClick={submit} disabled={!id || !confirmed || busy}>{busy ? "Approving…" : "Approve proposal"}</button>
          {error && <Feedback tone="error" title="Could not approve">{error}</Feedback>}
          {message && <Feedback tone="success" title="Proposal approved">{message}</Feedback>}
        </div>
      </section>
    </main>
  );
}
