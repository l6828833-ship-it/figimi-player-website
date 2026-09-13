"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

type Props = {
  mac: string;
  /** Page to return to after the action, so the operator is not bounced to the list. */
  back: string;
  action: (form: FormData) => Promise<void>;
  submitLabel?: string;
};

/**
 * The whole subscription control: a signed number of months.
 *
 * 1 means one month added, -1 means one month taken away. − and + step the number, so
 * going negative is one press rather than typing a sign, and Apply commits it. There are
 * no presets: a row of +1m…+2y buttons covered fewer cases than one field and took four
 * times the space.
 */
export default function ExtendControl({ mac, back, action, submitLabel = "Apply" }: Props) {
  const [value, setValue] = useState("1");

  // Clamped and rounded before it is submitted, and 0 is nudged to 1 rather than sent as a
  // no-op the server would reject.
  const parsed = Math.round(Number(value) || 0);
  const months = Math.max(-120, Math.min(120, parsed || 1));

  return <form action={action} className="admin-stepper">
    <input type="hidden" name="mac" value={mac} />
    <input type="hidden" name="back" value={back} />
    <input type="hidden" name="months" value={months} />

    <button type="button" onClick={() => setValue(String(Math.max(-120, months - 1)))} aria-label="One month less" title="One month less">
      <Minus size={14} />
    </button>
    <input
      type="number"
      inputMode="numeric"
      min={-120}
      max={120}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => setValue(String(months))}
      aria-label="Months to add, or a negative number to remove"
    />
    <button type="button" onClick={() => setValue(String(Math.min(120, months + 1)))} aria-label="One month more" title="One month more">
      <Plus size={14} />
    </button>
    <span className="admin-stepper-unit">mo</span>

    <button className="button small secondary" type="submit">{submitLabel}</button>
  </form>;
}
