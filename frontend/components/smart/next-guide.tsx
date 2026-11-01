"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { canOpen } from "../../lib/access";

type Dash = {
  datasetVersionId: string | null;
  pendingApprovals: number;
  activeJobs: number;
  latestSchedule: { status: string } | null;
};

type Hint = { title: string; copy: string; href: string; label: string };

const pageHints: Record<string, Hint> = {
  "/datasets": {
    title: "Choose cit_public.json, then press Import dataset.",
    copy: "When a dataset card appears, the next click is Timetable.",
    href: "/schedule",
    label: "Next: Timetable",
  },
  "/schedule": {
    title: "Click the dataset card, then Generate timetable.",
    copy: "You do not paste an id. After it starts, watch the job card.",
    href: "/jobs",
    label: "Next: Operations",
  },
  "/jobs": {
    title: "Click the newest job card.",
    copy: "Succeeded means a different admin can approve the week.",
    href: "/approvals",
    label: "Next: Approvals",
  },
  "/approvals": {
    title: "Open the proposal, then approve it.",
    copy: "If you generated the week, sign out and use reviewer@cit.local.",
    href: "/approve",
    label: "Next: Confirm",
  },
  "/approve": {
    title: "Click the proposal card, tick the box, then Approve.",
    copy: "After that, the week can be viewed and booked against.",
    href: "/schedule",
    label: "Next: Timetable",
  },
  "/bookings": {
    title: "Click the approved timetable card.",
    copy: "Then press Re-evaluate Spectra requests. Every decision includes a reason.",
    href: "/jobs",
    label: "Next: Operations",
  },
  "/repair": {
    title: "Click the approved week, then add the change.",
    copy: "Propose repair. It stays a proposal until another admin approves it.",
    href: "/approvals",
    label: "Next: Approvals",
  },
  "/manual": {
    title: "Click the approved week, then a room card.",
    copy: "Add a title and press Validate and schedule.",
    href: "/bookings",
    label: "Next: Venue requests",
  },
  "/profile": {
    title: "This is your campus identity.",
    copy: "Your role decides which of the four steps you are allowed to press.",
    href: "/dashboard",
    label: "Back to workspace",
  },
};

function retarget(hint: Hint, role: string): Hint {
  if (!role || canOpen(role, hint.href)) return hint;
  if (role === "club") {
    return {
      title: "Ask for a room, or read the published week.",
      copy: "You can submit a venue request. An admin publishes the timetable.",
      href: "/bookings",
      label: "Next: Venues",
    };
  }
  return {
    ...hint,
    copy: "An admin publishes proposals. You can read the timetable.",
    href: "/schedule",
    label: "Next: Timetable",
  };
}

function fromState(dash: Dash | null, role: string): Hint {
  if (role === "club") {
    return {
      title: "Ask for a room in plain language.",
      copy: "Submit a venue request from the workspace. You do not approve the result.",
      href: "/bookings",
      label: "Next: Venues",
    };
  }
  if (role === "faculty") {
    return {
      title: "Read your week, or describe a leave.",
      copy: "A repair stays a proposal until an admin approves it.",
      href: "/schedule",
      label: "Next: Timetable",
    };
  }
  if (!dash?.datasetVersionId) {
    return {
      title: "Start by importing the CIT dataset.",
      copy: "Open Data manager and choose cit_public.json. No id to type.",
      href: "/datasets",
      label: "Next: Data manager",
    };
  }
  const status = dash.latestSchedule?.status;
  if (!status || status === "failed") {
    return {
      title: "Generate the weekly timetable.",
      copy: "On Timetable, click the dataset card, then Generate.",
      href: "/schedule",
      label: "Next: Timetable",
    };
  }
  if (status === "generating" || dash.activeJobs > 0) {
    return {
      title: "A job is still running.",
      copy: "Open Operations and click the job card. Wait until it says succeeded.",
      href: "/jobs",
      label: "Next: Operations",
    };
  }
  if (dash.pendingApprovals > 0 || status === "pending_admin_approval") {
    return retarget({
      title: "A different admin needs to approve the week.",
      copy: "The creator cannot approve their own proposal. Use reviewer@cit.local.",
      href: "/approvals",
      label: "Next: Approvals",
    }, role);
  }
  return {
    title: "The week is approved. Read it or decide venues.",
    copy: "Open Timetable, click the approved week, then a student group.",
    href: "/schedule",
    label: "Next: Timetable",
  };
}

export function NextGuide({ path, role }: { path: string; role: string }) {
  const [dash, setDash] = useState<Dash | null>(null);
  useEffect(() => {
    api<Dash>("/api/v1/dashboard").then((result) => {
      if (result.data) setDash(result.data);
    });
  }, [path]);
  const hint = retarget(pageHints[path] ?? fromState(dash, role), role);
  return <Link href={hint.href}>{hint.label}</Link>;
}
