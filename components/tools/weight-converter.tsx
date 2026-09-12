"use client";

import { useState } from "react";
import { ArrowRightLeft, Check, Clipboard } from "lucide-react";

// 1 pound is defined as exactly 0.45359237 kilograms, so this factor is exact.
const KG_TO_LB = 1 / 0.45359237;
const round = (value: number) => Math.round(value * 100000) / 100000;
const format = (value: number) => String(round(value));

export function WeightConverter() {
  const [kg, setKg] = useState("1");
  const [lb, setLb] = useState(format(KG_TO_LB));
  const [copied, setCopied] = useState<"kg" | "lb" | null>(null);

  function fromKg(value: string) {
    setKg(value);
    const n = parseFloat(value);
    setLb(value.trim() === "" || Number.isNaN(n) ? "" : format(n * KG_TO_LB));
  }

  function fromLb(value: string) {
    setLb(value);
    const n = parseFloat(value);
    setKg(value.trim() === "" || Number.isNaN(n) ? "" : format(n / KG_TO_LB));
  }

  async function copy(which: "kg" | "lb", value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(which);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div className="unit-converter">
      <div className="unit-fields">
        <label className="unit-field">
          <span>Kilograms (kg)</span>
          <div className="unit-input">
            <input type="number" inputMode="decimal" min="0" step="any" value={kg} onChange={(e) => fromKg(e.target.value)} placeholder="0" />
            <button type="button" className="unit-copy" onClick={() => copy("kg", kg)} aria-label="Copy kilograms value">{copied === "kg" ? <Check size={16} /> : <Clipboard size={16} />}</button>
          </div>
        </label>
        <span className="unit-swap" aria-hidden="true"><ArrowRightLeft size={20} /></span>
        <label className="unit-field">
          <span>Pounds (lb)</span>
          <div className="unit-input">
            <input type="number" inputMode="decimal" min="0" step="any" value={lb} onChange={(e) => fromLb(e.target.value)} placeholder="0" />
            <button type="button" className="unit-copy" onClick={() => copy("lb", lb)} aria-label="Copy pounds value">{copied === "lb" ? <Check size={16} /> : <Clipboard size={16} />}</button>
          </div>
        </label>
      </div>
      <p className="unit-note">1 kilogram = 2.2046226218 pounds &middot; 1 pound = 0.45359237 kilograms</p>
      <table className="unit-table">
        <thead><tr><th scope="col">Kilograms</th><th scope="col">Pounds</th></tr></thead>
        <tbody>{[1, 2, 5, 10, 20, 50, 100].map((k) => <tr key={k}><td>{k} kg</td><td>{format(k * KG_TO_LB)} lb</td></tr>)}</tbody>
      </table>
    </div>
  );
}
