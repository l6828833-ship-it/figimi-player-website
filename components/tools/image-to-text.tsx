"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { Check, Clipboard, Download, FileImage, LoaderCircle, RotateCcw, ShieldCheck, XCircle } from "lucide-react";

type OcrProgress = { status?: string; progress?: number };
type OcrWorker = { recognize: (image: File | string) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };
type TesseractLike = {
  createWorker?: (lang?: string, oem?: number, options?: Record<string, unknown>) => Promise<OcrWorker>;
  recognize?: (image: File | string, lang: string, options?: Record<string, unknown>) => Promise<{ data: { text: string } }>;
};
declare global { interface Window { Tesseract?: TesseractLike } }

// Pin every asset to the same major version and give the worker explicit paths,
// otherwise the background worker fails to load its scripts from the CDN.
const VERSION = "5";
const CDN_URL = `https://cdn.jsdelivr.net/npm/tesseract.js@${VERSION}/dist/tesseract.min.js`;
const WORKER_PATH = `https://cdn.jsdelivr.net/npm/tesseract.js@${VERSION}/dist/worker.min.js`;
const CORE_PATH = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${VERSION}`;
const LANG_PATH = "https://tessdata.projectnaptha.com/4.0.0";
const ACCEPT = ".png,.jpg,.jpeg,.webp,.bmp,.gif";
const MAX_BYTES = 15 * 1024 * 1024;

function loadEngine() {
  return new Promise<TesseractLike>((resolve, reject) => {
    if (window.Tesseract) return resolve(window.Tesseract);
    const done = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error("The OCR engine could not start.")));
    const existing = document.querySelector<HTMLScriptElement>("script[data-tesseract]");
    if (existing) { existing.addEventListener("load", done); existing.addEventListener("error", () => reject(new Error("Failed to load the OCR engine."))); return; }
    const script = document.createElement("script");
    script.src = CDN_URL; script.async = true; script.dataset.tesseract = "true";
    script.onload = done;
    script.onerror = () => reject(new Error("Failed to load the OCR engine. Check your connection and try again."));
    document.body.appendChild(script);
  });
}

export function ImageToText() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "ready" | "reading" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function fail(text: string) { setMessage(text); setStatus("error"); }
  function reset() { if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(""); setText(""); setMessage(""); setProgress(0); setStatus("idle"); if (input.current) input.current.value = ""; }
  function choose(list: FileList | null) {
    if (!list?.length) return;
    const selected = list[0];
    if (!ACCEPT.split(",").some((extension) => selected.name.toLowerCase().endsWith(extension))) return fail(`${selected.name} is unsupported. Choose ${ACCEPT}.`);
    if (selected.size > MAX_BYTES) return fail("The image is larger than the 15 MB limit.");
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected); setPreview(URL.createObjectURL(selected)); setText(""); setMessage(""); setProgress(0); setStatus("ready");
  }
  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files); }

  async function extract() {
    if (!file) return;
    setStatus("reading"); setProgress(0); setText(""); setMessage("Loading the OCR engine (first run downloads language data)…");
    const logger = (event: OcrProgress) => {
      if (event.status === "recognizing text" && typeof event.progress === "number") { setProgress(Math.max(1, Math.round(event.progress * 100))); setMessage("Reading text from your image…"); }
      else if (event.status?.includes("loading") || event.status?.includes("initial")) setMessage("Loading the OCR engine (first run downloads language data)…");
    };
    try {
      const engine = await loadEngine();
      let output = "";
      if (typeof engine.createWorker === "function") {
        const worker = await engine.createWorker("eng", 1, { workerPath: WORKER_PATH, corePath: CORE_PATH, langPath: LANG_PATH, logger });
        try { const { data } = await worker.recognize(file); output = data.text; }
        finally { await worker.terminate(); }
      } else if (typeof engine.recognize === "function") {
        const { data } = await engine.recognize(file, "eng", { workerPath: WORKER_PATH, corePath: CORE_PATH, langPath: LANG_PATH, logger });
        output = data.text;
      } else {
        throw new Error("The OCR engine did not load correctly. Please refresh and try again.");
      }
      output = output.trim();
      setText(output); setProgress(100); setStatus("done");
      setMessage(output ? "Text extracted successfully." : "No readable text was detected. Try a sharper, higher-contrast image.");
    } catch (error) {
      fail(error instanceof Error ? error.message : "We could not read text from that image.");
    }
  }

  async function copy() { if (!text) return; try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard unavailable */ } }
  function download() { if (!text) return; const blob = new Blob([text], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${file?.name.replace(/\.[^.]+$/, "") || "extracted"}.txt`; link.click(); URL.revokeObjectURL(url); }

  return (
    <div className="image-to-text">
      <div className={`drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`} onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop} onClick={() => status !== "reading" && input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }} aria-label={`Upload ${ACCEPT} image`}>
        <input ref={input} hidden type="file" accept={ACCEPT} onChange={(e) => choose(e.target.files)} />
        {file && preview ? (
          <><span className="ocr-preview" role="img" aria-label={file.name} style={{ backgroundImage: `url(${preview})` }} /><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace</small></>
        ) : (
          <><span className="upload-icon"><FileImage /></span><strong>Drop an image here</strong><span>or click to browse your device</span><small>Supports {ACCEPT} · Maximum size 15 MB</small></>
        )}
      </div>

      {status === "reading" && <div className="conversion-progress" aria-live="polite"><div><LoaderCircle className="spin" /><span><strong>{message}</strong><small>Recognition runs privately in your browser.</small></span><b>{progress}%</b></div><progress max="100" value={progress}>{progress}%</progress></div>}
      {status === "error" && <div className="conversion-result error" role="alert"><XCircle /><span><strong>We could not read that image</strong><small>{message}</small></span><button className="button secondary small" onClick={reset}>Try again</button></div>}

      {status === "ready" && <div className="convert-actions"><button className="button secondary" onClick={reset}><RotateCcw size={17} />Clear</button><button className="button primary" onClick={extract}>Extract text</button></div>}

      {status === "done" && (
        <div className="ocr-result">
          <div className={`notice ${text ? "success" : "error"}`}>{message}</div>
          {text && <>
            <div className="editor-wrap"><textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Extracted text" /></div>
            <div className="tool-actions"><button className="button secondary" onClick={copy}>{copied ? <Check size={17} /> : <Clipboard size={17} />}{copied ? "Copied" : "Copy text"}</button><button className="button secondary" onClick={download}><Download size={17} />Download .txt</button><button className="button primary" onClick={reset}><RotateCcw size={17} />New image</button></div>
          </>}
        </div>
      )}

      <div className="converter-footer"><span><ShieldCheck size={17} />Private in-browser OCR</span><span>Your image is processed on your device and never uploaded to our server.</span></div>
    </div>
  );
}
