"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { PickerItem } from "../components/smart/picker-cards";

export type DatasetSummary = {
  id: string;
  dataset_id: string;
  source_name: string;
  created_at: string;
  rooms: number;
  faculty: number;
  groups: number;
  sessions: number;
  exams: number;
  booking_requests: number;
};

export type ScheduleSummary = {
  id: string;
  dataset_version_id: string;
  baseline_schedule_id: string | null;
  status: string;
  dataset_id: string;
  source_name: string;
  created_by_name: string | null;
  created_at: string;
  validation_report: {
    hard_violation_count?: number;
    soft_total?: number;
    stability?: { sessions_moved?: number };
  } | null;
};

export type CatalogRoom = {
  id: string;
  name: string;
  building: string | null;
  type: string;
  capacity: number;
  features: string[];
  accessible: boolean;
  allowedUses: string[];
};

export type CatalogFaculty = { id: string; name: string; department: string | null };
export type CatalogGroup = { id: string; name: string; year: number | null; department: string | null; size: number };

export type Catalog = { rooms: CatalogRoom[]; faculty: CatalogFaculty[]; groups: CatalogGroup[] };

export type JobSummary = {
  id: string;
  type: string;
  priority: number;
  status: string;
  error?: string | null;
  attempt_count: number;
  created_at: string;
};

export function useApiList<T>(path: string | null) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (tick === 0) setLoading(true);
    api<{ items: T[] }>(path).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.data) {
        setError(result.error ?? "Could not load options");
        setItems([]);
        return;
      }
      setError("");
      setItems(result.data.items);
    });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);
  return { items, loading, error, reload: () => setTick((value) => value + 1) };
}

export function useCatalog(scheduleId: string) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!scheduleId) {
      setCatalog(null);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    api<Catalog>(`/api/v1/schedules/${scheduleId}/catalog`).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.data) {
        setCatalog(null);
        setError(result.error ?? "Could not load campus resources");
        return;
      }
      setError("");
      setCatalog(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [scheduleId]);
  return { catalog, loading, error };
}

export function formatWhen(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export function datasetCards(items: DatasetSummary[]): PickerItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.source_name || item.dataset_id,
    status: item.dataset_id,
    description: `${item.sessions} sessions · ${item.rooms} rooms · ${item.faculty} faculty`,
    meta: `${item.groups} groups · ${item.exams} exams · ${item.booking_requests} venue requests · ${formatWhen(item.created_at)}`,
  }));
}

export function scheduleCards(items: ScheduleSummary[]): PickerItem[] {
  return items.map((item) => {
    const report = item.validation_report;
    const conflicts = report ? `${report.hard_violation_count ?? 0} hard conflicts` : "Not validated yet";
    const moved = item.baseline_schedule_id ? ` · ${report?.stability?.sessions_moved ?? 0} sessions moved` : "";
    return {
      id: item.id,
      title: item.baseline_schedule_id ? "Repair proposal" : "Weekly timetable",
      status: item.status.replaceAll("_", " "),
      description: `${item.source_name || item.dataset_id} · ${item.created_by_name ?? "Campus staff"}`,
      meta: `${conflicts}${moved} · ${formatWhen(item.created_at)}`,
    };
  });
}

const jobNames: Record<string, string> = {
  DECIDE_BOOKINGS: "Venue request",
  GENERATE_SCHEDULE: "Generate week",
  REPAIR_SCHEDULE: "Repair week",
  VALIDATE_SCHEDULE: "Validate week",
  EXPORT_SCHEDULE: "Export week",
};

export function jobCards(items: JobSummary[]): PickerItem[] {
  return items.map((item) => ({
    id: item.id,
    title: jobNames[item.type] ?? item.type.replaceAll("_", " "),
    status: item.status.replaceAll("_", " "),
    description: item.error || "Open the card to read the result",
    meta: `${formatWhen(item.created_at)}`,
  }));
}

export function roomCards(rooms: CatalogRoom[]): PickerItem[] {
  return rooms.map((room) => ({
    id: room.id,
    title: room.name,
    status: room.accessible ? "Accessible" : room.type,
    description: [room.building, room.type, `${room.capacity} seats`].filter(Boolean).join(" · "),
    meta: room.features.length ? room.features.join(", ") : "No listed features",
  }));
}

export function facultyCards(faculty: CatalogFaculty[]): PickerItem[] {
  return faculty.map((person) => ({
    id: person.id,
    title: person.name,
    description: person.department ?? "Campus faculty",
    meta: "Teaching timetable",
  }));
}

export function groupCards(groups: CatalogGroup[]): PickerItem[] {
  return groups.map((group) => ({
    id: group.id,
    title: group.name,
    description: [group.department, group.year ? `Year ${group.year}` : null, `${group.size} students`].filter(Boolean).join(" · "),
    meta: "Student group",
  }));
}
