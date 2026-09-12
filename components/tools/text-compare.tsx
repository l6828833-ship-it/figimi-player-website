"use client";

import { useMemo, useState } from "react";

type Diff = { value: string; type: "same" | "added" | "removed" };
function diffWords(a: string, b: string): Diff[] {
  const left = a.split(/(\s+)/).filter(Boolean).slice(0, 1500), right = b.split(/(\s+)/).filter(Boolean).slice(0, 1500);
  const matrix = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
  for (let i = 1; i <= left.length; i++) for (let j = 1; j <= right.length; j++) matrix[i][j] = left[i - 1] === right[j - 1] ? matrix[i - 1][j - 1] + 1 : Math.max(matrix[i - 1][j], matrix[i][j - 1]);
  const result: Diff[] = []; let i = left.length, j = right.length;
  while (i || j) { if (i && j && left[i - 1] === right[j - 1]) { result.push({ value: left[--i], type: "same" }); j--; } else if (j && (!i || matrix[i][j - 1] >= matrix[i - 1][j])) result.push({ value: right[--j], type: "added" }); else result.push({ value: left[--i], type: "removed" }); }
  return result.reverse();
}
export function TextCompare() {
  const [original, setOriginal] = useState(""); const [changed, setChanged] = useState(""); const diff = useMemo(() => diffWords(original, changed), [original, changed]);
  const added = diff.filter((part) => part.type === "added").length, removed = diff.filter((part) => part.type === "removed").length;
  return <div><div className="dual-editors"><label><span>Original text</span><textarea value={original} onChange={(e) => setOriginal(e.target.value)} placeholder="Paste the first version…" /></label><label><span>Changed text</span><textarea value={changed} onChange={(e) => setChanged(e.target.value)} placeholder="Paste the revised version…" /></label></div><div className="diff-summary"><span className="diff-added">+ {added} additions</span><span className="diff-removed">− {removed} removals</span></div><div className="diff-output" aria-live="polite">{diff.length ? diff.map((part, index) => <span className={`diff-${part.type}`} key={index}>{part.value}</span>) : <span className="placeholder">Differences will appear here.</span>}</div><p className="microcopy">For responsive browser performance, comparison is limited to the first 1,500 word and whitespace segments per side.</p></div>;
}
