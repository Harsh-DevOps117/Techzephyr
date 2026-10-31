"use client";

import { ChangeEvent, useState } from "react";
import { api, uuidv7 } from "../../lib/api";
import type { DatasetFile } from "../../lib/types";
import { datasetCards, useApiList, type DatasetSummary } from "../../lib/catalog";
import { PickerCards } from "../../components/smart/picker-cards";
import { DatabaseIcon, UploadIcon } from "../../components/ui/icons";
import { Feedback, StepHeader } from "../../components/ui/feedback";

export default function Datasets() {
  const imported = useApiList<DatasetSummary>("/api/v1/datasets");
  const [dataset, setDataset] = useState<DatasetFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetArmed, setResetArmed] = useState(false);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const parsed = JSON.parse(await file.text()) as DatasetFile;
      if (!parsed.dataset_id || !Array.isArray(parsed.sessions)) throw new Error("This does not look like a CIT dataset.");
      setDataset(parsed);
      setFileName(file.name);
    } catch (err) {
      setDataset(null);
      setError(err instanceof Error ? err.message : "Could not read this file.");
    }
  }

  async function upload() {
    if (!dataset) return;
    setBusy(true);
    const response = await api<{ datasetId: string }>("/api/v1/datasets/import", {
      method: "POST",
      headers: { "idempotency-key": uuidv7() },
      body: JSON.stringify({ sourceName: fileName, dataset }),
    });
    setBusy(false);
    if (!response.data) {
      setError(response.error ?? "Import failed");
      return;
    }
    setMessage(`${response.data.datasetId} is ready. Open Timetable and choose it from the dataset cards.`);
    imported.reload();
  }

  async function resetDemo() {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    setBusy(true);
    const response = await api<{ message: string }>("/api/v1/demo/reset", { method: "POST", body: "{}" });
    setBusy(false);
    if (!response.data) {
      setError(response.error ?? "Reset failed");
      return;
    }
    setDataset(null);
    setMessage(response.data.message);
    setResetArmed(false);
    imported.reload();
  }

  const stats = dataset
    ? [["Rooms", dataset.rooms], ["Faculty", dataset.faculty], ["Groups", dataset.student_groups], ["Courses", dataset.courses], ["Sessions", dataset.sessions], ["Bookings", dataset.booking_requests], ["Exams", dataset.exams]] as const
    : [];

  return (
    <main className="route">
      <StepHeader eyebrow="ADMIN · DATA MANAGER" title="Load the CIT dataset" copy="Import the official starter-pack file. We check its basic structure before it reaches the scheduler." />
      <section className="form-layout">
        <div className="form-card">
          <div className="section-title"><span className="card-icon mint"><DatabaseIcon /></span><div><h2>Dataset file</h2><p>Use cit_public.json from the starter pack.</p></div></div>
          <label className={`dropzone ${dataset ? "selected" : ""}`}>
            <UploadIcon />
            <strong>{dataset ? fileName : "Choose a JSON dataset"}</strong>
            <span>{dataset ? `${dataset.dataset_id} is ready to review` : "or drag it here · maximum 2 MB"}</span>
            <input type="file" accept="application/json,.json" onChange={choose} />
          </label>
          {error && <Feedback tone="error" title="Could not use this file">{error}</Feedback>}
          {dataset && (
            <>
              <div className="summary-grid">{stats.map(([label, value]) => <div key={label}><strong>{value?.length ?? 0}</strong><span>{label}</span></div>)}</div>
              <button className="primary wide" onClick={upload} disabled={busy}>{busy ? "Importing…" : "Import dataset"}</button>
            </>
          )}
          {message && <Feedback tone="success" title="Data manager updated">{message}</Feedback>}
          <PickerCards
            label="Imported datasets"
            hint="These are the versions the timetable screen can use"
            items={datasetCards(imported.items)}
            onSelect={() => undefined}
            readOnly
            loading={imported.loading}
            error={imported.error}
            empty="No dataset has been imported yet."
          />
        </div>
        <aside className="info-card">
          <p className="eyebrow">WHAT HAPPENS NEXT</p>
          <ol>
            <li><b>1</b><span><strong>Immutable version</strong>The original upload is preserved for auditability.</span></li>
            <li><b>2</b><span><strong>Generate</strong>Open Timetable and choose this dataset from the cards.</span></li>
            <li><b>3</b><span><strong>Validate</strong>Every output must pass the official checker.</span></li>
          </ol>
          <div className="danger-zone">
            <strong>Reset demo data</strong>
            <p>Clears imported datasets, schedules, jobs and decisions while preserving demo accounts.</p>
            <button onClick={resetDemo} disabled={busy}>{resetArmed ? "Click again to confirm" : "Reset demo"}</button>
          </div>
        </aside>
      </section>
    </main>
  );
}
