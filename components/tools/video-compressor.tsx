"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Film, LoaderCircle, RotateCcw, ShieldCheck, UploadCloud, XCircle } from "lucide-react";

type Preset = "quality" | "balanced" | "small";
type Result = { url: string; name: string; size: number };

const MAX_BYTES = 100 * 1024 * 1024;
const acceptedExtensions = [".mp4", ".mov", ".webm", ".mkv"];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function VideoCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preset, setPreset] = useState<Preset>("balanced");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "ready" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const operation = useRef(0);
  const previewUrl = useRef("");
  const resultUrl = useRef("");

  useEffect(() => () => {
    operation.current += 1;
    request.current?.abort();
    request.current = null;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
  }, []);

  function clearResult() {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = "";
    setResult(null);
  }

  function fail(text: string) {
    clearResult();
    setMessage(text);
    setStatus("error");
  }

  function reset() {
    operation.current += 1;
    request.current?.abort();
    request.current = null;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = "";
    clearResult();
    setFile(null);
    setPreview("");
    setDragging(false);
    setProgress(0);
    setMessage("");
    setStatus("idle");
    if (input.current) input.current.value = "";
  }

  function choose(list: FileList | null) {
    if (status === "working" || !list?.length) return;
    operation.current += 1;
    const selected = list[0];
    const lowerName = selected.name.toLowerCase();
    if (!acceptedExtensions.some((extension) => lowerName.endsWith(extension))) return fail("Choose an MP4, MOV, WebM, or MKV video.");
    if (selected.size > MAX_BYTES) return fail("The video is larger than the 100 MB limit.");

    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    clearResult();
    const nextPreview = URL.createObjectURL(selected);
    previewUrl.current = nextPreview;
    setFile(selected);
    setPreview(nextPreview);
    setProgress(0);
    setMessage("");
    setStatus("ready");
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (status !== "working") choose(event.dataTransfer.files);
  }

  function compress() {
    if (!file) return;
    const selectedFile = file;
    const selectedPreset = preset;
    const currentOperation = ++operation.current;
    const isCurrent = () => operation.current === currentOperation;
    clearResult();
    setStatus("working");
    setProgress(2);
    setMessage("Uploading securely…");

    const xhr = new XMLHttpRequest();
    request.current = xhr;
    xhr.open("POST", "/api/compress/video");
    xhr.responseType = "blob";
    xhr.setRequestHeader("Content-Type", selectedFile.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(selectedFile.name));
    xhr.setRequestHeader("X-Compression-Preset", selectedPreset);
    xhr.upload.onprogress = (event) => {
      if (isCurrent() && event.lengthComputable) setProgress(Math.min(55, Math.round(event.loaded / event.total * 55)));
    };
    xhr.upload.onload = () => {
      if (!isCurrent()) return;
      setProgress(60);
      setMessage("Compressing video on the server…");
    };
    xhr.onprogress = (event) => {
      if (isCurrent() && event.lengthComputable && event.total > 0) {
        setProgress(75 + Math.min(24, Math.round(event.loaded / event.total * 24)));
      }
    };
    xhr.onload = async () => {
      if (!isCurrent()) return;
      request.current = null;
      if (xhr.status < 200 || xhr.status >= 300) {
        let errorMessage = xhr.status === 429
          ? "The compressor is busy. Please try again shortly."
          : "Video compression failed. Try a smaller or shorter file.";
        try {
          const body = JSON.parse(await (xhr.response as Blob).text()) as { error?: string };
          if (body.error) errorMessage = body.error;
        } catch {
          // The fallback above intentionally hides non-JSON server responses.
        }
        if (isCurrent()) fail(errorMessage);
        return;
      }

      const header = xhr.getResponseHeader("Content-Disposition") || "";
      const encoded = header.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      let name = `${selectedFile.name.replace(/\.[^.]+$/, "")}-compressed.mp4`;
      if (encoded) {
        try { name = decodeURIComponent(encoded); } catch { /* Keep the safe fallback name. */ }
      }
      const response = xhr.response as Blob;
      const size = Number(xhr.getResponseHeader("X-Compressed-Size") || response.size);
      const url = URL.createObjectURL(response);
      if (!isCurrent()) {
        URL.revokeObjectURL(url);
        return;
      }
      resultUrl.current = url;
      setResult({ url, name, size });
      setProgress(100);
      setStatus("done");
      setMessage(size < selectedFile.size
        ? `Saved ${Math.round((1 - size / selectedFile.size) * 100)}% of the original size.`
        : "The result is not smaller. Try the Small file preset.");
    };
    xhr.onerror = () => {
      if (!isCurrent()) return;
      request.current = null;
      fail("The connection was interrupted. Please try again.");
    };
    xhr.onabort = () => {
      if (!isCurrent()) return;
      request.current = null;
      fail("Video compression was canceled.");
    };
    xhr.ontimeout = () => {
      if (!isCurrent()) return;
      request.current = null;
      fail("Video compression timed out. Try a shorter or smaller video.");
    };
    xhr.timeout = 295_000;
    xhr.send(selectedFile);
  }

  const working = status === "working";

  return <div className="media-compressor video-compressor">
    {file && preview && <div className="video-preview-panel"><video className="video-preview" src={preview} muted controls preload="metadata" /></div>}
    <div
      className={`drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); if (!working) setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      onClick={() => { if (!working) input.current?.click(); }}
      role="button"
      tabIndex={working ? -1 : 0}
      aria-disabled={working}
      onKeyDown={(event) => {
        if (!working && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          input.current?.click();
        }
      }}
      aria-label="Upload an MP4, MOV, WebM, or MKV video"
    >
      <input ref={input} hidden disabled={working} type="file" accept="video/mp4,video/quicktime,video/webm,.mkv" onChange={(event) => choose(event.target.files)} />
      {file
        ? <><span className="upload-icon selected"><Film /></span><strong>{file.name}</strong><small>{formatBytes(file.size)} · Click to replace</small></>
        : <><span className="upload-icon"><UploadCloud /></span><strong>Drop a video here</strong><span>or click to browse your device</span><small>MP4, MOV, WebM, or MKV · Maximum 100 MB · Up to 10 minutes</small></>}
    </div>

    {file && !working && <div className="compressor-controls video-presets"><label>Compression preset<select value={preset} onChange={(event) => { clearResult(); setPreset(event.target.value as Preset); if (status === "done") setStatus("ready"); }}><option value="quality">Higher quality — up to 1080p</option><option value="balanced">Balanced — up to 720p</option><option value="small">Small file — up to 480p</option></select></label><p>{preset === "quality" ? "Keeps more detail with moderate compression." : preset === "balanced" ? "A practical mix of quality and file size." : "Uses stronger compression for easier sharing."}</p></div>}

    {working && <div className="conversion-progress" aria-live="polite"><div><LoaderCircle className="spin" /><span><strong>{message}</strong><small>Please keep this page open. Longer videos take more time.</small></span><b>{progress}%</b><button className="button secondary small" onClick={reset}>Cancel</button></div><progress max="100" value={progress}>{progress}%</progress></div>}
    {status === "error" && <div className="conversion-result error" role="alert"><XCircle /><span><strong>We could not compress that video</strong><small>{message}</small></span><button className="button secondary small" onClick={reset}>Try again</button></div>}
    {status === "done" && result && file && <div className="compression-result"><div className="conversion-result success" role="status"><CheckCircle2 /><span><strong>Compression complete</strong><small>{message}</small></span><a className="button primary small" href={result.url} download={result.name}><Download size={17} />Download MP4</a></div><div className="compression-stats"><span><b>{formatBytes(file.size)}</b>Original</span><span><b>{formatBytes(result.size)}</b>Compressed</span><span><b>{preset === "quality" ? "1080p" : preset === "balanced" ? "720p" : "480p"}</b>Maximum output</span></div></div>}

    <div className="converter-footer"><span><ShieldCheck size={17} />Secure temporary processing</span><span>Video files are removed after the response completes.</span></div>
    {status === "ready" && <div className="convert-actions"><button className="button secondary" onClick={reset}><RotateCcw size={17} />Clear</button><button className="button primary" onClick={compress}><Film size={17} />Compress video</button></div>}
  </div>;
}
