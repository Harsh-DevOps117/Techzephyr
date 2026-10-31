"use client";

import { useMemo, useState } from "react";

export type PickerItem = {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  status?: string;
};

function statusClass(status: string) {
  const value = status.toLowerCase();
  if (value.includes("approv") || value.includes("succeed") || value.includes("validat")) return "succeeded";
  if (value.includes("fail") || value.includes("reject")) return "failed";
  if (value.includes("run") || value.includes("generat") || value.includes("queue") || value.includes("pending") || value.includes("await")) return "running";
  return "";
}

export function PickerCards({
  label,
  hint,
  items,
  selectedId = "",
  selectedIds,
  onSelect,
  loading = false,
  empty = "Nothing is available yet.",
  error,
  readOnly = false,
}: {
  label: string;
  hint?: string;
  items: PickerItem[];
  selectedId?: string;
  selectedIds?: string[];
  onSelect: (id: string) => void;
  loading?: boolean;
  empty?: string;
  error?: string;
  readOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.title, item.description, item.meta, item.status].filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [items, query]);

  function selected(id: string) {
    return selectedIds ? selectedIds.includes(id) : id === selectedId;
  }

  return (
    <div className="picker">
      <div className="picker-head">
        <div>
          <span>{label}</span>
          {hint && <small>{hint}</small>}
        </div>
        {items.length > 6 && (
          <input
            className="picker-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name"
            aria-label={`Search ${label}`}
          />
        )}
      </div>
      {loading && <p className="picker-state">Loading options…</p>}
      {error && <p className="picker-state picker-error">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="picker-state">{empty}</p>}
      {!loading && items.length > 0 && filtered.length === 0 && <p className="picker-state">No matches. Try another name.</p>}
      <div className="picker-grid" role={readOnly ? "list" : "listbox"} aria-label={label} aria-multiselectable={readOnly ? undefined : Boolean(selectedIds)}>
        {filtered.map((item) => {
          const isSelected = !readOnly && selected(item.id);
          const body = (
            <>
              {item.status && <em className={`job-status ${statusClass(item.status)}`}>{item.status.replaceAll("_", " ")}</em>}
              <strong>{item.title}</strong>
              {item.description && <p>{item.description}</p>}
              {item.meta && <small>{item.meta}</small>}
            </>
          );
          if (readOnly) return <article className="picker-card static" key={item.id}>{body}</article>;
          return (
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              key={item.id}
              className={`picker-card${isSelected ? " selected" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}
