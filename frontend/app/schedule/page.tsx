"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, uuidv7 } from "../../lib/api";
import { datasetCards, facultyCards, groupCards, roomCards, scheduleCards, useApiList, useCatalog, type DatasetSummary, type ScheduleSummary } from "../../lib/catalog";
import { PickerCards } from "../../components/smart/picker-cards";
import { CalendarIcon, CheckIcon } from "../../components/ui/icons";
import { Feedback, StepHeader } from "../../components/ui/feedback";

type TimetableItem = {
  session_id: string;
  day: string;
  start_period: number;
  room_id: string;
  courseId: string;
  kind: string;
  groups: string[];
  facultyId: string;
  duration: number;
};

const dayOrder = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function Schedule() {
  const datasets = useApiList<DatasetSummary>("/api/v1/datasets");
  const schedules = useApiList<ScheduleSummary>("/api/v1/schedules");
  const [dataset, setDataset] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ jobId: string; scheduleVersionId: string } | null>(null);
  const [error, setError] = useState("");
  const [viewId, setViewId] = useState("");
  const [filterType, setFilterType] = useState<"group" | "faculty" | "room">("group");
  const [filterValue, setFilterValue] = useState("");
  const [items, setItems] = useState<TimetableItem[]>([]);
  const [viewError, setViewError] = useState("");
  const catalog = useCatalog(viewId);

  useEffect(() => {
    if (!viewId) {
      setItems([]);
      return;
    }
    const query = filterValue ? `?${filterType}=${encodeURIComponent(filterValue)}` : "";
    let cancelled = false;
    api<{ items: TimetableItem[] }>(`/api/v1/schedules/${viewId}/timetable${query}`).then((response) => {
      if (cancelled) return;
      if (!response.data) {
        setViewError(response.error ?? "Could not load timetable");
        setItems([]);
        return;
      }
      setViewError("");
      setItems(response.data.items);
    });
    return () => {
      cancelled = true;
    };
  }, [viewId, filterType, filterValue]);

  async function generate() {
    setBusy(true);
    setError("");
    const response = await api<{ jobId: string; scheduleVersionId: string }>("/api/v1/schedules/generate", {
      method: "POST",
      headers: { "idempotency-key": uuidv7() },
      body: JSON.stringify({ datasetVersionId: dataset }),
    });
    setBusy(false);
    if (!response.data) {
      setError(response.error ?? "Generation failed");
      return;
    }
    setResult(response.data);
    setViewId(response.data.scheduleVersionId);
    setFilterValue("");
    schedules.reload();
  }

  async function download() {
    const response = await api<Record<string, unknown>>(`/api/v1/schedules/${viewId}/export`);
    if (!response.data) {
      setViewError(response.error ?? "Export is not ready");
      return;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "schedule.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const filterItems = catalog.catalog
    ? filterType === "group"
      ? [{ id: "", title: "Every group", description: "Show the full timetable", meta: "No filter" }, ...groupCards(catalog.catalog.groups)]
      : filterType === "faculty"
        ? [{ id: "", title: "Every faculty member", description: "Show the full timetable", meta: "No filter" }, ...facultyCards(catalog.catalog.faculty)]
        : [{ id: "", title: "Every room", description: "Show the full timetable", meta: "No filter" }, ...roomCards(catalog.catalog.rooms)]
    : [];

  return (
    <main className="route">
      <StepHeader eyebrow="ADMIN · TIMETABLE" title="Generate and inspect the timetable" copy="Choose an imported dataset, schedule every session, then open a timetable by group, faculty or room." />
      <section className="form-layout">
        <div className="form-card">
          <div className="section-title"><span className="card-icon coral"><CalendarIcon /></span><div><h2>Generation input</h2><p>Start from an imported dataset. Select it below.</p></div></div>
          <PickerCards
            label="Dataset"
            hint="Imported versions appear here after Data manager"
            items={datasetCards(datasets.items)}
            selectedId={dataset}
            onSelect={setDataset}
            loading={datasets.loading}
            error={datasets.error}
            empty="No datasets yet. Import cit_public.json in Data manager."
          />
          <div className="constraint-list">
            <span><CheckIcon /> No faculty, group or room clashes</span>
            <span><CheckIcon /> Labs and lunch rules enforced</span>
            <span><CheckIcon /> Accessibility and capacity checked</span>
            <span><CheckIcon /> Fixed and elective slots preserved</span>
          </div>
          <button className="primary wide" onClick={generate} disabled={busy || !dataset}>{busy ? "Starting generation…" : "Generate timetable"}</button>
          {error && <Feedback tone="error" title="Could not generate">{error}</Feedback>}
          {result && <Feedback tone="success" title="Generation queued"><span>The timetable is being built in the background.</span><br /><Link href={`/jobs?id=${result.jobId}`}>View job status →</Link></Feedback>}
        </div>
        <aside className="info-card">
          <p className="eyebrow">VALIDATION PIPELINE</p>
          <div className="pipeline">
            <span className="done">1</span><div><strong>Place sessions</strong><small>Hard constraints first</small></div><i />
            <span>2</span><div><strong>Optimise</strong><small>Reduce soft penalties</small></div><i />
            <span>3</span><div><strong>Official validator</strong><small>Must report zero hard violations</small></div><i />
            <span>4</span><div><strong>Admin approval</strong><small>Required before publishing</small></div>
          </div>
        </aside>
      </section>
      <section className="form-card timetable-browser">
        <div className="panel-title">
          <div><p className="eyebrow">LIVE SCHEDULE VIEW</p><h2>Find a timetable</h2></div>
          <button className="secondary" disabled={!viewId} onClick={download}>Export schedule.json</button>
        </div>
        <PickerCards
          label="Schedule"
          hint="Choose a generated or repaired timetable"
          items={scheduleCards(schedules.items)}
          selectedId={viewId}
          onSelect={(id) => { setViewId(id); setFilterValue(""); }}
          loading={schedules.loading}
          error={schedules.error}
          empty="Generate a timetable to see it here."
        />
        <label className="filter-kind">View by
          <select value={filterType} onChange={(event) => { setFilterType(event.target.value as "group" | "faculty" | "room"); setFilterValue(""); }}>
            <option value="group">Student group</option>
            <option value="faculty">Faculty</option>
            <option value="room">Room</option>
          </select>
        </label>
        {viewId && (
          <PickerCards
            label={filterType === "group" ? "Student group" : filterType === "faculty" ? "Faculty" : "Room"}
            hint="Click a card to filter. The full timetable stays one click away."
            items={filterItems}
            selectedId={filterValue}
            onSelect={setFilterValue}
            loading={catalog.loading}
            error={catalog.error}
            empty="This schedule has no matching resources yet."
          />
        )}
        {viewError && <Feedback tone="error" title="Could not load timetable">{viewError}</Feedback>}
        {items.length > 0 && (
          <div className="schedule-table">
            <div className="table-head"><span>Day / period</span><span>Course</span><span>Room</span><span>Faculty</span><span>Groups</span></div>
            {[...items].sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day) || a.start_period - b.start_period).map((item) => (
              <div key={item.session_id}>
                <span><b>{item.day}</b> · P{item.start_period}{item.duration > 1 ? `–P${item.start_period + item.duration - 1}` : ""}</span>
                <span><b>{item.courseId}</b><small>{item.kind}</small></span>
                <span>{catalog.catalog?.rooms.find((room) => room.id === item.room_id)?.name ?? item.room_id}</span>
                <span>{catalog.catalog?.faculty.find((person) => person.id === item.facultyId)?.name ?? item.facultyId}</span>
                <span>{item.groups.map((groupId) => catalog.catalog?.groups.find((group) => group.id === groupId)?.name ?? groupId).join(", ")}</span>
              </div>
            ))}
          </div>
        )}
        {viewId && !viewError && items.length === 0 && <p className="picker-state">No sessions match this view yet. If generation just started, check Operations and come back.</p>}
      </section>
    </main>
  );
}
