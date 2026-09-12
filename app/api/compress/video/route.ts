import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 100 * 1024 * 1024;
const MAX_DURATION_SECONDS = 10 * 60;
const MAX_FRAME_RATE = 120;
const MAX_CONCURRENT_JOBS = 1;
const LOCAL_PROTOCOLS = "file,crypto,data";
const allowedExtensions = new Set([".mp4", ".mov", ".webm", ".mkv"]);
const allowedContainers = new Set(["mov", "mp4", "matroska", "webm"]);
const presets = {
  quality: { crf: "23", width: 1920, height: 1080, audio: "160k" },
  balanced: { crf: "27", width: 1280, height: 720, audio: "128k" },
  small: { crf: "31", width: 854, height: 480, audio: "96k" },
} as const;
type Preset = keyof typeof presets;

type ProbeData = {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    avg_frame_rate?: string;
    r_frame_rate?: string;
  }>;
  format?: { duration?: string; format_name?: string };
};

class ProcessingError extends Error {
  constructor(message: string, readonly status: number, readonly detail?: string) {
    super(message);
    this.name = "ProcessingError";
  }
}

// This semaphore is intentionally per process. Distributed limits belong at the
// edge or in a shared queue, as documented in docs/DEPLOYMENT.md.
let activeJobs = 0;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function decodeName(value: string | null) {
  if (!value) return "video.mp4";
  try { return decodeURIComponent(value); } catch { return value; }
}

function safeBase(name: string) {
  return path.basename(name, path.extname(name)).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "video";
}

function processEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    HOME: tmpdir(),
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
  };
}

async function writeRequestBody(body: ReadableStream<Uint8Array>, destination: string, signal: AbortSignal) {
  let total = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.length;
      if (total > MAX_BYTES) {
        callback(new ProcessingError("The video is larger than the 100 MB limit.", 413));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(body as unknown as NodeReadableStream<Uint8Array>),
      limiter,
      createWriteStream(destination, { flags: "wx" }),
      { signal },
    );
  } catch (error) {
    if (signal.aborted) throw new ProcessingError("The upload was canceled.", 499);
    throw error;
  }
  return total;
}

function runProcess(options: {
  command: string;
  args: string[];
  signal: AbortSignal;
  timeoutMs: number;
  failureMessage: string;
  missingMessage: string;
}) {
  const { command, args, signal, timeoutMs, failureMessage, missingMessage } = options;
  if (signal.aborted) return Promise.reject(new ProcessingError("The request was canceled.", 499));

  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: processEnvironment(),
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let terminalError: Error | undefined;
    let stopFallback: NodeJS.Timeout | undefined;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (stopFallback) clearTimeout(stopFallback);
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve({ stdout, stderr });
    };
    const stop = (error: Error) => {
      if (settled || terminalError) return;
      terminalError = error;
      child.kill("SIGKILL");
      stopFallback = setTimeout(() => finish(error), 5_000);
      stopFallback.unref();
    };
    const onAbort = () => stop(new ProcessingError("The request was canceled.", 499));
    const timer = setTimeout(
      () => stop(new ProcessingError("Video processing timed out. Try a shorter or smaller video.", 504)),
      timeoutMs,
    );

    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < 64_000) stdout += chunk.toString().slice(0, 64_000 - stdout.length);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 16_000) stderr += chunk.toString().slice(0, 16_000 - stderr.length);
    });
    child.once("error", (error: NodeJS.ErrnoException) => {
      finish(error.code === "ENOENT"
        ? new ProcessingError(missingMessage, 503, error.message)
        : new ProcessingError(failureMessage, 422, error.message));
    });
    child.once("close", (code) => {
      if (terminalError) {
        finish(terminalError);
        return;
      }
      finish(code === 0
        ? undefined
        : new ProcessingError(failureMessage, 422, stderr.trim() || `Process exited with status ${code}.`));
    });
  });
}

function parseFrameRate(value?: string) {
  if (!value) return 0;
  const [numerator, denominator = "1"] = value.split("/");
  const top = Number(numerator);
  const bottom = Number(denominator);
  return Number.isFinite(top) && Number.isFinite(bottom) && bottom > 0 ? top / bottom : 0;
}

async function probeVideo(input: string, signal: AbortSignal) {
  const command = process.env.FFPROBE_PATH || "ffprobe";
  const { stdout } = await runProcess({
    command,
    signal,
    timeoutMs: 15_000,
    missingMessage: "The video compressor is not installed on this server.",
    failureMessage: "The file is not a supported, playable video.",
    args: [
      "-v", "error",
      "-protocol_whitelist", LOCAL_PROTOCOLS,
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate:format=duration,format_name",
      "-of", "json",
      input,
    ],
  });

  let data: ProbeData;
  try {
    data = JSON.parse(stdout) as ProbeData;
  } catch {
    throw new ProcessingError("The file is not a supported, playable video.", 422, "ffprobe returned invalid JSON.");
  }

  const video = data.streams?.find((stream) => stream.codec_type === "video");
  const duration = Number(data.format?.duration);
  const formats = (data.format?.format_name || "").split(",");
  const width = Number(video?.width);
  const height = Number(video?.height);
  const codecName = video?.codec_name || "";
  const averageFrameRate = parseFrameRate(video?.avg_frame_rate);
  const frameRate = averageFrameRate > 0 ? averageFrameRate : parseFrameRate(video?.r_frame_rate);

  if (!formats.some((format) => allowedContainers.has(format))) {
    throw new ProcessingError("Choose an MP4, MOV, WebM, or MKV video.", 415, `Unexpected container: ${formats.join(",")}`);
  }
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) {
    throw new ProcessingError("Choose a video that is 10 minutes or shorter.", 422, `Invalid duration: ${duration}`);
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || Math.max(width, height) > 3840 || Math.min(width, height) > 2160) {
    throw new ProcessingError("Choose a video with dimensions no larger than 4K.", 422, `Invalid dimensions: ${width}x${height}`);
  }
  if (!Number.isFinite(frameRate) || frameRate <= 0 || frameRate > MAX_FRAME_RATE) {
    throw new ProcessingError("Choose a video with a frame rate of 120 fps or lower.", 422, `Invalid frame rate: ${frameRate}`);
  }
  return { duration, formats, width, height, codecName, frameRate };
}

async function runFfmpeg(input: string, output: string, preset: Preset, signal: AbortSignal) {
  const settings = presets[preset];
  const filter = `scale=w='min(iw,${settings.width})':h='min(ih,${settings.height})':force_original_aspect_ratio=decrease:force_divisible_by=2`;
  const command = process.env.FFMPEG_PATH || "ffmpeg";
  await runProcess({
    command,
    signal,
    timeoutMs: 260_000,
    missingMessage: "The video compressor is not installed on this server.",
    failureMessage: "The video could not be compressed. Check that it is a supported, playable file.",
    args: [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-protocol_whitelist", LOCAL_PROTOCOLS,
      "-i", input,
      "-map", "0:v:0", "-map", "0:a?", "-vf", filter,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", settings.crf,
      "-threads", "2", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", settings.audio,
      "-movflags", "+faststart", "-map_metadata", "-1", "-sn",
      "-fs", String(MAX_OUTPUT_BYTES),
      output,
    ],
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) return jsonError("The video is larger than the 100 MB limit.", 413);
  if (!request.body) return jsonError("Choose a video to compress.", 400);
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    return NextResponse.json(
      { error: "The video compressor is busy. Please try again in a moment." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "20" } },
    );
  }

  const originalName = decodeName(request.headers.get("x-file-name"));
  const extension = path.extname(originalName).toLowerCase();
  if (!allowedExtensions.has(extension)) return jsonError("Choose an MP4, MOV, WebM, or MKV video.", 415);
  const requestedPreset = request.headers.get("x-compression-preset") || "balanced";
  const preset: Preset = Object.hasOwn(presets, requestedPreset) ? requestedPreset as Preset : "balanced";
  const deadlineController = new AbortController();
  const processingSignal = AbortSignal.any([request.signal, deadlineController.signal]);
  const deadlineTimer = setTimeout(() => deadlineController.abort(), 285_000);
  let workspace = "";
  let responseStreaming = false;
  let jobHeld = true;
  activeJobs += 1;

  const releaseJob = () => {
    if (!jobHeld) return;
    jobHeld = false;
    activeJobs = Math.max(0, activeJobs - 1);
  };

  try {
    workspace = await mkdtemp(path.join(tmpdir(), "figimi-video-"));
    const inputPath = path.join(workspace, `input${extension}`);
    const outputPath = path.join(workspace, "compressed.mp4");
    const originalSize = await writeRequestBody(request.body, inputPath, processingSignal);
    if (!originalSize) throw new ProcessingError("The uploaded video is empty.", 400);

    const sourceMetadata = await probeVideo(inputPath, processingSignal);
    await runFfmpeg(inputPath, outputPath, preset, processingSignal);

    const outputInfo = await stat(outputPath);
    if (!outputInfo.size) throw new ProcessingError("The video compressor did not produce an output file.", 422);
    if (outputInfo.size > MAX_OUTPUT_BYTES) throw new ProcessingError("The compressed video exceeds the 100 MB output limit.", 422);
    const outputMetadata = await probeVideo(outputPath, processingSignal);
    const settings = presets[preset];
    const durationTolerance = Math.max(2, sourceMetadata.duration * 0.02);
    if (!outputMetadata.formats.includes("mp4") || outputMetadata.codecName !== "h264") {
      throw new ProcessingError("The compressor did not produce a compatible MP4 video.", 422);
    }
    if (outputMetadata.width > settings.width || outputMetadata.height > settings.height) {
      throw new ProcessingError("The compressed video exceeds the selected resolution limit.", 422);
    }
    if (outputMetadata.duration + durationTolerance < sourceMetadata.duration) {
      throw new ProcessingError("The compressed video is incomplete. Try a shorter video or a smaller preset.", 422);
    }
    releaseJob();
    await rm(inputPath, { force: true }).catch(() => undefined);

    const stream = createReadStream(outputPath);
    let cleaned = false;
    const cleanup = async () => {
      if (cleaned) return;
      cleaned = true;
      await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
    };
    stream.once("end", () => void cleanup());
    stream.once("close", () => void cleanup());
    stream.once("error", () => void cleanup());
    responseStreaming = true;
    const downloadName = `${safeBase(originalName)}-compressed.mp4`;
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(outputInfo.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Original-Size": String(originalSize),
        "X-Compressed-Size": String(outputInfo.size),
      },
    });
  } catch (error) {
    const deadlineExceeded = deadlineController.signal.aborted && !request.signal.aborted;
    const knownError = error instanceof ProcessingError ? error : null;
    const message = deadlineExceeded
      ? "Video processing timed out. Try a shorter or smaller video."
      : knownError?.message || "The video could not be compressed. Check that it is a supported, playable file.";
    const status = deadlineExceeded ? 504 : knownError?.status || 422;
    console.error("Video compression failed", {
      message,
      detail: knownError?.detail || (error instanceof Error ? error.message : "Unknown error"),
      preset,
    });
    return jsonError(message, status);
  } finally {
    clearTimeout(deadlineTimer);
    releaseJob();
    if (!responseStreaming) await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}
