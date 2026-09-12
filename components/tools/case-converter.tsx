"use client";

import { useMemo, useState } from "react";
import { Check, Clipboard, Download } from "lucide-react";

type Mode = "sentence" | "title" | "upper" | "lower";
const smallWords = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "the", "to", "up", "yet"]);
function convert(text: string, mode: Mode) {
  if (mode === "upper") return text.toLocaleUpperCase();
  if (mode === "lower") return text.toLocaleLowerCase();
  if (mode === "sentence") return text.toLocaleLowerCase().replace(/(^|[.!?]\s+|\n+)(["'([{]*)(\p{L})/gu, (_, prefix, punctuation, letter) => `${prefix}${punctuation}${letter.toLocaleUpperCase()}`);
  return text.toLocaleLowerCase().replace(/\b[\p{L}\p{N}'’-]+\b/gu, (word, offset) => (smallWords.has(word) && offset > 0 ? word : word.charAt(0).toLocaleUpperCase() + word.slice(1)));
}
export function CaseConverter() {
  const [text, setText] = useState(""); const [mode, setMode] = useState<Mode>("sentence"); const [copied, setCopied] = useState(false); const output = useMemo(() => convert(text, mode), [text, mode]);
  async function copy() { await navigator.clipboard.writeText(output); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  function download() { const href = URL.createObjectURL(new Blob([output], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = href; link.download = "capitalized-text.txt"; link.click(); URL.revokeObjectURL(href); }
  return <div><div className="mode-tabs" role="group" aria-label="Capitalization style">{(["sentence", "title", "upper", "lower"] as Mode[]).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item} case</button>)}</div><div className="dual-editors"><label><span>Original text</span><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text to fix…" /></label><label><span>Converted text</span><textarea readOnly value={output} placeholder="Your result appears here…" /></label></div><div className="tool-actions"><button className="button secondary" disabled={!output} onClick={copy}>{copied ? <Check size={17} /> : <Clipboard size={17} />}{copied ? "Copied" : "Copy result"}</button><button className="button primary" disabled={!output} onClick={download}><Download size={17} />Download .txt</button></div></div>;
}
