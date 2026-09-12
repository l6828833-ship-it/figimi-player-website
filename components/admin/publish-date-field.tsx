"use client";

import { useState } from "react";

// Convert a stored UTC ISO timestamp into the value a <input type="datetime-local">
// expects, shifted into the visitor's local timezone.
function toLocalInputValue(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// Renders the publish date/time field in the admin's LOCAL timezone and submits
// a correct UTC ISO string in a hidden `published_at` field. This fixes posts
// going live at the wrong time when the server timezone differs from the editor's.
export function PublishDateField({ defaultValue }: { defaultValue?: string | null }) {
  const [local, setLocal] = useState(() => toLocalInputValue(defaultValue));
  const isoUtc = local ? new Date(local).toISOString() : "";
  return (
    <label>
      Publish date and time
      <input type="datetime-local" value={local} onChange={(event) => setLocal(event.target.value)} />
      <input type="hidden" name="published_at" value={isoUtc} />
      <small>Uses your local time. Leave blank to publish immediately.</small>
    </label>
  );
}
