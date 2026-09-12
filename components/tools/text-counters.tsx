"use client";

import { useMemo, useState } from "react";
import { Clipboard, RotateCcw } from "lucide-react";

const wordsFrom = (text: string) => text.trim() ? text.trim().match(/[\p{L}\p{N}'’-]+/gu) || [] : [];

export function TextCounter({ characterOnly = false }: { characterOnly?: boolean }) {
  const [text, setText] = useState("");
  const stats = useMemo(() => {
    const words = wordsFrom(text);
    const sentences = text.trim() ? (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).filter((value) => value.trim()).length : 0;
    const paragraphs = text.trim() ? text.split(/\n\s*\n/).filter((value) => value.trim()).length : 0;
    const frequencies = new Map<string, number>();
    words.forEach((word) => { const clean = word.toLocaleLowerCase(); if (clean.length > 2) frequencies.set(clean, (frequencies.get(clean) || 0) + 1); });
    return { words: words.length, chars: text.length, noSpaces: text.replace(/\s/g, "").length, sentences, paragraphs, lines: text ? text.split("\n").length : 0, reading: words.length ? Math.ceil(words.length / 200) : 0, keywords: [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8) };
  }, [text]);
  const primary = characterOnly ? [{ label: "Characters", value: stats.chars }, { label: "Without spaces", value: stats.noSpaces }, { label: "Words", value: stats.words }, { label: "Lines", value: stats.lines }] : [{ label: "Words", value: stats.words }, { label: "Characters", value: stats.chars }, { label: "Sentences", value: stats.sentences }, { label: "Paragraphs", value: stats.paragraphs }, { label: "Reading time", value: `${stats.reading} min` }];
  return <div className="counter-tool"><div className="stat-strip">{primary.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div><div className="editor-wrap"><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Type or paste your text here…" aria-label="Text to count" /><div className="editor-actions"><span>{text.length.toLocaleString()} characters</span><div><button className="icon-button" onClick={() => navigator.clipboard.writeText(text)} disabled={!text} title="Copy text"><Clipboard size={17} /></button><button className="icon-button" onClick={() => setText("")} disabled={!text} title="Clear text"><RotateCcw size={17} /></button></div></div></div>{!characterOnly && <section className="keyword-panel"><h3>Keyword density</h3>{stats.keywords.length ? <div className="keyword-list">{stats.keywords.map(([word, count]) => <span key={word}>{word}<b>{count} · {stats.words ? ((count / stats.words) * 100).toFixed(1) : 0}%</b></span>)}</div> : <p>Enter a few words to see the most frequent keywords.</p>}</section>}</div>;
}
