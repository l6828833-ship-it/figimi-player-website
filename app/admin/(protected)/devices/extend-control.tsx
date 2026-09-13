"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

type Props = {
  mac: string;
  /** Page to return to after the action, so the operator is not bounced to the list. */
  back: string;
  action: (form: FormData) => Promise<void>;
  /** Adds a months/days switch; the devices table keeps it months-only to stay narrow. */
  withUnit?: boolean;
  defaultValue?: number;
  submitLabel?: string;
};

/**
 * Type the number, or nudge it with − and +.
 *
 * The − button lowers the number you are about to add, it never subtracts time from a
 * subscription: taking days off a customer's term is a different, riskier job and stays
 * on the "End now" button where it can't happen by a stray click.
 */
export default function ExtendControl({ mac, back, action, withUnit = false, defaultValue = 1, submitLabel = "Add" }: Props) {
  const [value, setValue] = useState(String(defaultValue));
  const [unit, setUnit] = useState<"months" | "days">("months");

  const max = unit === "months" ? 120 : 3650;
  const amount = Math.min(max, Math.max(1, Math.round(Number(value) || 1)));

  return <form action={action} className="admin-stepper">
    <input type="hidden" name="mac" value={mac} />
    <input type="hidden" name="back" value={back} />
    <input type="hidden" name="unit" value={unit} />
    {/* The submitted amount is the clamped number, so a typo cannot post 0 or 9999. */}
    <input type="hidden" name="amount" value={amount} />

    <button type="button" onClick={() => setValue(String(Math.max(1, amount - 1)))} aria-label={`One ${unit === "months" ? "month" : "day"} less`} title="Less">
      <Minus size={14} />
    </button>
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => setValue(String(amount))}
      aria-label={withUnit ? "Amount to add" : "Months to add"}
    />
    <button type="button" onClick={() => setValue(String(Math.min(max, amount + 1)))} aria-label={`One ${unit === "months" ? "month" : "day"} more`} title="More">
      <Plus size={14} />
    </button>

    {withUnit
      ? <select value={unit} onChange={(event) => setUnit(event.target.value as "months" | "days")} aria-label="Unit">
        <option value="months">months</option>
        <option value="days">days</option>
      </select>
      : <span className="admin-stepper-unit">mo</span>}

    <button className="button small secondary" type="submit">{submitLabel}</button>
  </form>;
}
