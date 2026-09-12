"use client";

import { FormEvent, useState } from "react";
import { Globe2, LoaderCircle } from "lucide-react";

type Result = { url: string; title: string; words: number; characters: number; readingTime: number };
export function WebsiteCounter() {
  const [url, setUrl] = useState(""); const [result, setResult] = useState<Result | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); setResult(null); try { const response = await fetch("/api/website-word-count", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to analyze this page."); setResult(body); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to analyze this page."); } finally { setLoading(false); } }
  return <div><form className="url-form" onSubmit={submit}><label><span className="sr-only">Public web page URL</span><Globe2 size={20} /><input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" /></label><button className="button primary" disabled={loading}>{loading && <LoaderCircle className="spin" size={18} />}{loading ? "Analyzing…" : "Count words"}</button></form>{error && <div className="notice error" role="alert">{error}</div>}{result && <div className="website-result"><span className="eyebrow">Analysis complete</span><h3>{result.title || "Untitled page"}</h3><a href={result.url} target="_blank" rel="noopener noreferrer">{result.url}</a><div className="stat-strip"><div><strong>{result.words.toLocaleString()}</strong><span>Words</span></div><div><strong>{result.characters.toLocaleString()}</strong><span>Characters</span></div><div><strong>{result.readingTime} min</strong><span>Reading time</span></div></div></div>}</div>;
}
