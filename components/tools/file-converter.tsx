"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, File as FileIcon, LoaderCircle, RotateCcw, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
import type { ToolDefinition } from "@/types";

type Output = { url: string; name: string };
const MAX_BYTES = 20 * 1024 * 1024;

export function FileConverter({ tool }: { tool: ToolDefinition }) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "ready" | "converting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const operation = useRef(0);
  const outputUrl = useRef("");
  const allowMultiple = tool.slug === "jpg-to-pdf" || tool.slug === "png-to-pdf" || tool.slug === "tiff-to-pdf";

  useEffect(() => () => {
    operation.current += 1;
    request.current?.abort();
    request.current = null;
    if (outputUrl.current) URL.revokeObjectURL(outputUrl.current);
  }, []);

  function clearOutput() {
    if (outputUrl.current) URL.revokeObjectURL(outputUrl.current);
    outputUrl.current = "";
    setOutput(null);
  }

  function reset() {
    operation.current += 1;
    request.current?.abort();
    request.current = null;
    clearOutput();
    setFiles([]);
    setDragging(false);
    setMessage("");
    setProgress(0);
    setStatus("idle");
    if (input.current) input.current.value = "";
  }

  function fail(text: string) {
    clearOutput();
    setMessage(text);
    setStatus("error");
  }

  function choose(list: FileList | null) {
    if (status === "converting" || !list?.length) return;
    operation.current += 1;
    const selected = Array.from(list);
    if (!allowMultiple && selected.length > 1) return fail("Choose one file for this converter.");
    if (selected.length > 20) return fail("You can combine up to 20 images at a time.");
    const total = selected.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_BYTES) return fail("The total upload is larger than the 20 MB limit.");
    const allowed = (tool.accept || "").split(",");
    const invalid = selected.find((file) => !allowed.some((extension) => file.name.toLowerCase().endsWith(extension)));
    if (invalid) return fail(`${invalid.name} is unsupported. Choose ${tool.accept}.`);
    clearOutput();
    setFiles(selected);
    setStatus("ready");
    setMessage("");
    setProgress(0);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (status !== "converting") choose(event.dataTransfer.files);
  }

  function convert() {
    if (!files.length) return;
    const selectedFiles = [...files];
    const currentOperation = ++operation.current;
    const isCurrent = () => operation.current === currentOperation;
    clearOutput();
    setStatus("converting");
    setProgress(4);
    setMessage("Uploading securely…");
    const body = new FormData();
    selectedFiles.forEach((file) => body.append("files", file));
    const xhr = new XMLHttpRequest();
    request.current = xhr;
    xhr.open("POST", `/api/convert/${tool.slug}`);
    xhr.responseType = "blob";
    xhr.upload.onprogress = (event) => {
      if (isCurrent() && event.lengthComputable) setProgress(Math.min(68, Math.round(event.loaded / event.total * 68)));
    };
    xhr.upload.onload = () => {
      if (!isCurrent()) return;
      setProgress(72);
      setMessage("Converting your file…");
    };
    xhr.onload = async () => {
      if (!isCurrent()) return;
      request.current = null;
      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const body = JSON.parse(await (xhr.response as Blob).text()) as { error?: string };
          fail(body.error || "Conversion failed.");
        } catch {
          fail("Conversion failed. The file may be corrupt or unsupported.");
        }
        return;
      }
      const header = xhr.getResponseHeader("Content-Disposition") || "";
      const encoded = header.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      let name = `converted.${tool.output?.toLowerCase() || "bin"}`;
      if (encoded) {
        try { name = decodeURIComponent(encoded); } catch { /* Keep the safe fallback name. */ }
      }
      const url = URL.createObjectURL(xhr.response as Blob);
      if (!isCurrent()) {
        URL.revokeObjectURL(url);
        return;
      }
      outputUrl.current = url;
      setOutput({ url, name });
      setProgress(100);
      setMessage("Your file is ready to download.");
      setStatus("done");
    };
    xhr.onerror = () => {
      if (!isCurrent()) return;
      request.current = null;
      fail("The network connection was interrupted. Please try again.");
    };
    xhr.onabort = () => {
      if (!isCurrent()) return;
      request.current = null;
      fail("Conversion was canceled.");
    };
    xhr.ontimeout = () => {
      if (!isCurrent()) return;
      request.current = null;
      fail("Conversion timed out. Try a smaller file.");
    };
    xhr.timeout = 190_000;
    xhr.send(body);
  }

  const converting = status === "converting";
  return <div className="file-converter">
    <div
      className={`drop-zone ${dragging ? "dragging" : ""} ${files.length ? "has-file" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); if (!converting) setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      onClick={() => { if (!converting) input.current?.click(); }}
      role="button"
      tabIndex={converting ? -1 : 0}
      aria-disabled={converting}
      onKeyDown={(event) => {
        if (!converting && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          input.current?.click();
        }
      }}
      aria-label={`Upload ${tool.accept} file`}
    >
      <input ref={input} hidden disabled={converting} type="file" accept={tool.accept} multiple={allowMultiple} onChange={(event) => choose(event.target.files)} />
      {files.length
        ? <><span className="upload-icon selected"><FileIcon /></span><strong>{files.length === 1 ? files[0].name : `${files.length} images selected`}</strong><small>{(files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB · Click to replace</small></>
        : <><span className="upload-icon"><UploadCloud /></span><strong>Drop {allowMultiple ? "your files" : "a file"} here</strong><span>or click to browse your device</span><small>Supports {tool.accept} · Maximum total size 20 MB{allowMultiple ? " · Up to 20 images" : ""}</small></>}
    </div>
    {converting && <div className="conversion-progress" aria-live="polite"><div><LoaderCircle className="spin" /><span><strong>{message}</strong><small>Please keep this page open.</small></span><b>{progress}%</b><button className="button secondary small" onClick={reset}>Cancel</button></div><progress max="100" value={progress}>{progress}%</progress></div>}
    {status === "error" && <div className="conversion-result error" role="alert"><XCircle /><span><strong>We could not convert that file</strong><small>{message}</small></span><button className="button secondary small" onClick={reset}>Try again</button></div>}
    {status === "done" && output && <div className="conversion-result success" role="status"><CheckCircle2 /><span><strong>Conversion complete</strong><small>{output.name}</small></span><a className="button primary small" href={output.url} download={output.name}><Download size={17} />Download</a></div>}
    <div className="converter-footer"><span><ShieldCheck size={17} />Secure temporary processing</span><span>Files are deleted immediately after the response and never later than one hour.</span></div>
    {status === "ready" && <div className="convert-actions"><button className="button secondary" onClick={reset}><RotateCcw size={17} />Clear</button><button className="button primary" onClick={convert}>Convert to {tool.output}</button></div>}
  </div>;
}
