"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Image as ImageIcon, LoaderCircle, RotateCcw, ShieldCheck, UploadCloud, XCircle } from "lucide-react";

type Format = "image/webp" | "image/jpeg" | "image/png";
type Result = { url: string; name: string; size: number; width: number; height: number };

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 25_000_000;
const extensions: Record<Format, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const data = offset + 8;
    if (chunk === "VP8X" && size >= 10 && data + 10 <= bytes.length) {
      const width = 1 + bytes[data + 4] + (bytes[data + 5] << 8) + (bytes[data + 6] << 16);
      const height = 1 + bytes[data + 7] + (bytes[data + 8] << 8) + (bytes[data + 9] << 16);
      return { type: "image/webp" as const, width, height };
    }
    if (chunk === "VP8 " && size >= 10 && data + 10 <= bytes.length && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      return { type: "image/webp" as const, width: view.getUint16(data + 6, true) & 0x3fff, height: view.getUint16(data + 8, true) & 0x3fff };
    }
    if (chunk === "VP8L" && size >= 5 && data + 5 <= bytes.length && bytes[data] === 0x2f) {
      const bits = view.getUint32(data + 1, true);
      return { type: "image/webp" as const, width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    if (data + size > bytes.length) return null;
    offset = data + size + (size % 2);
  }
  return null;
}

async function readImageMetadata(file: File) {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n" && ascii(bytes, 12, 4) === "IHDR") {
    return { type: "image/png" as const, width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (marker === 0xd9 || marker === 0xda || offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (startOfFrame.has(marker) && length >= 7) {
        return { type: "image/jpeg" as const, width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
      }
      offset += length;
    }
    throw new Error("The JPG header does not contain readable dimensions.");
  }
  const webp = webpDimensions(bytes);
  if (webp) return webp;
  throw new Error("Choose a valid JPG, PNG, or WebP image.");
}

async function loadImage(file: File) {
  if ("createImageBitmap" in window) return createImageBitmap(file, { imageOrientation: "from-image" });
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The image could not be decoded."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ImageCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [quality, setQuality] = useState(78);
  const [format, setFormat] = useState<Format>("image/webp");
  const [maxDimension, setMaxDimension] = useState(1920);
  const [status, setStatus] = useState<"idle" | "ready" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const previewUrl = useRef("");
  const resultUrl = useRef("");

  useEffect(() => () => {
    operation.current += 1;
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
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = "";
    clearResult();
    setFile(null);
    setPreview("");
    setDragging(false);
    setMessage("");
    setStatus("idle");
    if (input.current) input.current.value = "";
  }

  async function choose(list: FileList | null) {
    if (status === "working" || !list?.length) return;
    const currentOperation = ++operation.current;
    const selected = list[0];
    clearResult();
    if (selected.size > MAX_BYTES) return fail("The image is larger than the 20 MB limit.");

    try {
      const metadata = await readImageMetadata(selected);
      if (operation.current !== currentOperation) return;
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) {
        return fail("This image is too large. Choose an image under 25 megapixels.");
      }
    } catch (error) {
      if (operation.current === currentOperation) fail(error instanceof Error ? error.message : "Choose a valid JPG, PNG, or WebP image.");
      return;
    }

    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const nextPreview = URL.createObjectURL(selected);
    previewUrl.current = nextPreview;
    setFile(selected);
    setPreview(nextPreview);
    setMessage("");
    setStatus("ready");
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (status !== "working") choose(event.dataTransfer.files);
  }

  async function compress() {
    if (!file) return;
    const currentOperation = ++operation.current;
    const selectedFile = file;
    const selectedFormat = format;
    const selectedQuality = quality;
    const selectedMaxDimension = maxDimension;
    clearResult();
    setStatus("working");
    setMessage("Compressing in your browser…");
    let source: ImageBitmap | HTMLImageElement | null = null;

    try {
      source = await loadImage(selectedFile);
      if (operation.current !== currentOperation) return;

      const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
      const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
      if (!sourceWidth || !sourceHeight || sourceWidth * sourceHeight > MAX_PIXELS) {
        throw new Error("This image is too large. Choose an image under 25 megapixels.");
      }

      const scale = selectedMaxDimension > 0
        ? Math.min(1, selectedMaxDimension / sourceWidth, selectedMaxDimension / sourceHeight)
        : 1;
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: selectedFormat !== "image/jpeg" });
      if (!context) throw new Error("Your browser could not create an image canvas.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (selectedFormat === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }
      context.drawImage(source, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("Your browser could not create the compressed image.")),
        selectedFormat,
        selectedQuality / 100,
      ));
      if (operation.current !== currentOperation) return;
      if (blob.size > MAX_OUTPUT_BYTES) {
        throw new Error("The compressed result is larger than 25 MB. Choose smaller dimensions or a lower quality.");
      }

      const base = selectedFile.name.replace(/\.[^.]+$/, "") || "image";
      const name = `${base}-compressed.${extensions[selectedFormat]}`;
      const url = URL.createObjectURL(blob);
      if (operation.current !== currentOperation) {
        URL.revokeObjectURL(url);
        return;
      }
      resultUrl.current = url;
      setResult({ url, name, size: blob.size, width, height });
      setStatus("done");
      setMessage(blob.size < selectedFile.size
        ? `Saved ${Math.round((1 - blob.size / selectedFile.size) * 100)}% of the original size.`
        : "The result is not smaller. Try a lower quality or smaller dimensions.");
    } catch (error) {
      if (operation.current === currentOperation) {
        fail(error instanceof Error ? error.message : "The image could not be compressed.");
      }
    } finally {
      if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();
    }
  }

  const working = status === "working";

  return <div className="media-compressor image-compressor">
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
      aria-label="Upload a JPG, PNG, or WebP image"
    >
      <input ref={input} hidden disabled={working} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choose(event.target.files)} />
      {file && preview
        ? <><span className="compressor-preview" role="img" aria-label={file.name} style={{ backgroundImage: `url(${preview})` }} /><strong>{file.name}</strong><small>{formatBytes(file.size)} · Click to replace</small></>
        : <><span className="upload-icon"><UploadCloud /></span><strong>Drop an image here</strong><span>or click to browse your device</span><small>JPG, PNG, or WebP · Maximum 20 MB · Up to 25 megapixels</small></>}
    </div>

    {file && !working && <div className="compressor-controls">
      <label>Output format<select value={format} onChange={(event) => { clearResult(); setFormat(event.target.value as Format); if (status === "done") setStatus("ready"); }}><option value="image/webp">WebP — smallest for the web</option><option value="image/jpeg">JPG — broad compatibility</option><option value="image/png">PNG — lossless</option></select></label>
      <label>Maximum size<select value={maxDimension} onChange={(event) => { clearResult(); setMaxDimension(Number(event.target.value)); if (status === "done") setStatus("ready"); }}><option value="0">Keep original dimensions</option><option value="2560">Up to 2560 px</option><option value="1920">Up to 1920 px</option><option value="1280">Up to 1280 px</option><option value="800">Up to 800 px</option></select></label>
      <label className="quality-control">Quality <strong>{format === "image/png" ? "Lossless" : `${quality}%`}</strong><input type="range" min="35" max="95" step="1" value={quality} disabled={format === "image/png"} onChange={(event) => { clearResult(); setQuality(Number(event.target.value)); if (status === "done") setStatus("ready"); }} /></label>
    </div>}

    {working && <div className="conversion-progress" aria-live="polite"><div><LoaderCircle className="spin" /><span><strong>{message}</strong><small>Nothing is uploaded to our server.</small></span></div><progress /></div>}
    {status === "error" && <div className="conversion-result error" role="alert"><XCircle /><span><strong>We could not compress that image</strong><small>{message}</small></span><button className="button secondary small" onClick={reset}>Try again</button></div>}
    {status === "done" && result && file && <div className="compression-result"><div className="conversion-result success" role="status"><CheckCircle2 /><span><strong>Compression complete</strong><small>{message}</small></span><a className="button primary small" href={result.url} download={result.name}><Download size={17} />Download</a></div><div className="compression-stats"><span><b>{formatBytes(file.size)}</b>Original</span><span><b>{formatBytes(result.size)}</b>Compressed</span><span><b>{result.width} × {result.height}</b>Dimensions</span></div></div>}

    <div className="converter-footer"><span><ShieldCheck size={17} />Private in-browser compression</span><span>Your image never leaves this device.</span></div>
    {status === "ready" && <div className="convert-actions"><button className="button secondary" onClick={reset}><RotateCcw size={17} />Clear</button><button className="button primary" onClick={compress}><ImageIcon size={17} />Compress image</button></div>}
  </div>;
}
