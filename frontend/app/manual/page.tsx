"use client";

import { useMemo, useState } from "react";
import { api } from "../../lib/api";
import { roomCards, scheduleCards, useApiList, useCatalog, type ScheduleSummary } from "../../lib/catalog";
import { PickerCards } from "../../components/smart/picker-cards";
import { CalendarIcon } from "../../components/ui/icons";
import { Feedback, StepHeader } from "../../components/ui/feedback";

const days = ["MON", "TUE", "WED", "THU", "FRI"] as const;

export default function ManualEvent() {
  const schedules = useApiList<ScheduleSummary>("/api/v1/schedules");
  const approved = schedules.items.filter((item) => item.status === "approved");
  const [form, setForm] = useState({
    scheduleVersionId: "",
    title: "",
    day: "MON",
    startPeriod: 10,
    endPeriod: 11,
    roomId: "",
    attendance: 50,
    needs: [] as string[],
    mandatoryGroups: [] as string[],
    reason: "Department event",
  });
  const catalog = useCatalog(form.scheduleVersionId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const eventRooms = useMemo(
    () => (catalog.catalog?.rooms ?? []).filter((room) => room.allowedUses.includes("event")),
    [catalog.catalog],
  );
  const selectedRoom = eventRooms.find((room) => room.id === form.roomId);
  const featureChoices = selectedRoom
    ? [...selectedRoom.features, ...(selectedRoom.accessible ? ["accessible"] : [])]
    : [];

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  async function submit() {
    setBusy(true);
    setError("");
    setSuccess("");
    const result = await api<{ validation: string }>("/api/v1/manual-events", {
      method: "POST",
      body: JSON.stringify({
        scheduleVersionId: form.scheduleVersionId,
        title: form.title,
        day: form.day,
        startPeriod: Number(form.startPeriod),
        endPeriod: Number(form.endPeriod),
        roomId: form.roomId,
        attendance: Number(form.attendance),
        needs: form.needs,
        mandatoryGroups: form.mandatoryGroups,
        reason: form.reason,
      }),
    });
    setBusy(false);
    if (!result.data) {
      setError(result.error ?? "Event could not be scheduled");
      return;
    }
    setSuccess(`${form.title} passed every hard constraint and was scheduled.`);
  }

  return (
    <main className="route">
      <StepHeader eyebrow="AUTHORIZED ROLES · MANUAL SCHEDULING" title="Schedule an event manually" copy="Manual events use the same room, capacity, availability and mandatory-group checks as automated bookings." />
      <section className="form-layout">
        <div className="form-card">
          <div className="section-title"><span className="card-icon coral"><CalendarIcon /></span><div><h2>Event details</h2><p>Requires an approved timetable.</p></div></div>
          <PickerCards
            label="Approved timetable"
            hint="The event is checked against this published schedule"
            items={scheduleCards(approved)}
            selectedId={form.scheduleVersionId}
            onSelect={(id) => setForm({ ...form, scheduleVersionId: id, roomId: "", needs: [], mandatoryGroups: [] })}
            loading={schedules.loading}
            error={schedules.error}
            empty="Approve a timetable before scheduling an event by hand."
          />
          <label>Event title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Guest lecture on sustainable design" /></label>
          <div className="three-fields">
            <label>Day<select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })}>{days.map((day) => <option key={day}>{day}</option>)}</select></label>
            <label>Start period<input type="number" min="1" max="13" value={form.startPeriod} onChange={(event) => setForm({ ...form, startPeriod: Number(event.target.value) })} /></label>
            <label>End period<input type="number" min="1" max="13" value={form.endPeriod} onChange={(event) => setForm({ ...form, endPeriod: Number(event.target.value) })} /></label>
          </div>
          <label>Attendance<input type="number" value={form.attendance} onChange={(event) => setForm({ ...form, attendance: Number(event.target.value) })} /></label>
          {form.scheduleVersionId && (
            <PickerCards
              label="Room"
              hint="Only venues that can host events are shown"
              items={roomCards(eventRooms)}
              selectedId={form.roomId}
              onSelect={(id) => setForm({ ...form, roomId: id, needs: [] })}
              loading={catalog.loading}
              error={catalog.error}
              empty="This timetable has no event-capable rooms."
            />
          )}
          {selectedRoom && (
            <PickerCards
              label="Required features"
              hint="Optional. Leave them unselected if the room only needs to be free."
              items={featureChoices.map((feature) => ({ id: feature, title: feature.replaceAll("_", " "), description: `${selectedRoom.name} offers this`, meta: "Facility" }))}
              selectedIds={form.needs}
              onSelect={(id) => setForm({ ...form, needs: toggle(form.needs, id) })}
              empty="This room has no extra facilities to request."
            />
          )}
          {form.scheduleVersionId && catalog.catalog && (
            <PickerCards
              label="Groups that must attend"
              hint="Optional. Selected groups must be free for the whole event."
              items={catalog.catalog.groups.map((group) => ({
                id: group.id,
                title: group.name,
                description: [group.department, group.year ? `Year ${group.year}` : null, `${group.size} students`].filter(Boolean).join(" · "),
                meta: "Student group",
              }))}
              selectedIds={form.mandatoryGroups}
              onSelect={(id) => setForm({ ...form, mandatoryGroups: toggle(form.mandatoryGroups, id) })}
              empty="No student groups are in this dataset."
            />
          )}
          <label>Reason<input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
          <button className="primary wide" onClick={submit} disabled={busy || !form.scheduleVersionId || !form.title || !form.roomId}>{busy ? "Checking constraints…" : "Validate and schedule"}</button>
          {error && <Feedback tone="error" title="Event blocked">{error}</Feedback>}
          {success && <Feedback tone="success" title="Event scheduled">{success}</Feedback>}
        </div>
        <aside className="info-card">
          <p className="eyebrow">ENFORCED CHECKS</p>
          <div className="stat-callout"><strong>Room availability</strong><p>No overlap with classes, bookings, maintenance or manual events.</p></div>
          <div className="stat-callout"><strong>Capacity and features</strong><p>The selected venue must fit attendance and every requested facility.</p></div>
          <div className="stat-callout"><strong>Student groups</strong><p>Mandatory groups must be free for the complete event.</p></div>
        </aside>
      </section>
    </main>
  );
}
