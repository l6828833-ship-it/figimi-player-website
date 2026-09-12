"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clipboard, Lock, Shuffle, Unlock } from "lucide-react";

type Swatch = { hex: string; locked: boolean };

function randomHex() {
  const bytes = new Uint8Array(3);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 3; i++) bytes[i] = Math.floor(Math.random() * 256);
  return `#${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
function hexToRgb(hex: string) { const value = parseInt(hex.slice(1), 16); return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const; }
function hexToHsl(hex: string) { const [r, g, b] = hexToRgb(hex).map((v) => v / 255); const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min; let h = 0; if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); return [Math.round((h + 360) % 360), Math.round(d ? (d / (1 - Math.abs(2 * l - 1))) * 100 : 0), Math.round(l * 100)] as const; }
function readableInk(hex: string) { const [r, g, b] = hexToRgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#171525" : "#ffffff"; }

export function RandomColor() {
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState("");

  const shuffle = useCallback(() => { setSwatches((current) => current.map((swatch) => (swatch.locked ? swatch : { hex: randomHex(), locked: false }))); }, []);
  useEffect(() => { setSwatches(Array.from({ length: 5 }, () => ({ hex: randomHex(), locked: false }))); }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.code === "Space" && event.target === document.body) { event.preventDefault(); shuffle(); } }
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [shuffle]);

  if (!swatches.length) return <div className="random-color" aria-busy="true" />;
  const current = swatches[Math.min(active, swatches.length - 1)]?.hex || "#000000";
  const [r, g, b] = hexToRgb(current), [h, s, l] = hexToHsl(current);

  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setCopied(value); setTimeout(() => setCopied(""), 1200); } catch { /* clipboard unavailable */ } }
  function toggleLock(index: number) { setSwatches((current) => current.map((swatch, i) => (i === index ? { ...swatch, locked: !swatch.locked } : swatch))); }

  return (
    <div className="random-color">
      <div className="color-tool">
        <div className="color-picker">
          <div className="color-preview large" style={{ backgroundColor: current, color: readableInk(current) }}><span>{current}</span></div>
          <button className="button primary" onClick={shuffle}><Shuffle size={17} />Generate colors</button>
          <small className="microcopy">Tip: press the space bar to shuffle unlocked swatches.</small>
        </div>
        <div className="color-controls">
          <div className="color-values">
            <label>HEX<input readOnly value={current} onFocus={(e) => e.currentTarget.select()} /></label>
            <label>RGB<input readOnly value={`${r}, ${g}, ${b}`} onFocus={(e) => e.currentTarget.select()} /></label>
            <label>HSL<input readOnly value={`${h}°, ${s}%, ${l}%`} onFocus={(e) => e.currentTarget.select()} /></label>
          </div>
          <div className="copy-row">
            <button className="button secondary" onClick={() => copy(current)}>{copied === current ? <Check size={17} /> : <Clipboard size={17} />}Copy HEX</button>
            <button className="button secondary" onClick={() => copy(`rgb(${r}, ${g}, ${b})`)}>{copied === `rgb(${r}, ${g}, ${b})` ? <Check size={17} /> : <Clipboard size={17} />}Copy RGB</button>
            <button className="button secondary" onClick={() => copy(`hsl(${h}, ${s}%, ${l}%)`)}>{copied === `hsl(${h}, ${s}%, ${l}%)` ? <Check size={17} /> : <Clipboard size={17} />}Copy HSL</button>
          </div>
        </div>
        <section className="palette-panel">
          <div><h3>Random swatches</h3><button className="button secondary small" onClick={shuffle}><Shuffle size={16} />Shuffle</button></div>
          <div className="palette random">
            {swatches.map((swatch, index) => (
              <button key={index} className={index === active ? "selected" : ""} style={{ background: swatch.hex, color: readableInk(swatch.hex) }} onClick={() => setActive(index)} aria-label={`Select ${swatch.hex}`}>
                <span className="lock-toggle" role="button" tabIndex={0} aria-label={swatch.locked ? "Unlock color" : "Lock color"} onClick={(e) => { e.stopPropagation(); toggleLock(index); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleLock(index); } }}>{swatch.locked ? <Lock size={15} /> : <Unlock size={15} />}</span>
                <span onClick={(e) => { e.stopPropagation(); copy(swatch.hex); }}>{copied === swatch.hex ? "Copied" : swatch.hex}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
