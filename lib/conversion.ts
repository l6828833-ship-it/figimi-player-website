import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Document, Packer, Paragraph } from "docx";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import PptxGenJS from "pptxgenjs";
import sharp from "sharp";

export const conversionNames = ["pdf-to-word", "word-to-pdf", "pdf-to-png", "pdf-to-jpg", "pdf-to-excel", "excel-to-pdf", "ppt-to-pdf", "pdf-to-ppt", "jpg-to-pdf", "png-to-pdf", "heic-to-jpg", "jpg-to-heic", "tiff-to-pdf", "pdf-to-tiff"] as const;
export type ConversionName = typeof conversionNames[number];
export const isConversionName = (value: string): value is ConversionName => conversionNames.includes(value as ConversionName);

const rules: Record<ConversionName, { extensions: string[]; multiple?: boolean }> = {
  "pdf-to-word": { extensions: [".pdf"] }, "word-to-pdf": { extensions: [".doc", ".docx"] },
  "pdf-to-png": { extensions: [".pdf"] }, "pdf-to-jpg": { extensions: [".pdf"] },
  "pdf-to-excel": { extensions: [".pdf"] }, "excel-to-pdf": { extensions: [".xls", ".xlsx"] },
  "ppt-to-pdf": { extensions: [".ppt", ".pptx"] }, "pdf-to-ppt": { extensions: [".pdf"] },
  "jpg-to-pdf": { extensions: [".jpg", ".jpeg"], multiple: true }, "png-to-pdf": { extensions: [".png"], multiple: true },
  "heic-to-jpg": { extensions: [".heic", ".heif"] }, "jpg-to-heic": { extensions: [".jpg", ".jpeg"] },
  "tiff-to-pdf": { extensions: [".tif", ".tiff"], multiple: true }, "pdf-to-tiff": { extensions: [".pdf"] },
};
const mimeByExtension: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".heic": "image/heic", ".tif": "image/tiff", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".zip": "application/zip" };

function safeBase(name: string) { return path.basename(name, path.extname(name)).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "converted"; }
function looksLikeHeic(buffer: Buffer) {
  if (buffer.length < 16 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  const declaredSize = buffer.readUInt32BE(0);
  const boxEnd = declaredSize >= 16 ? Math.min(buffer.length, declaredSize, 256) : Math.min(buffer.length, 256);
  const brands: string[] = [buffer.subarray(8, 12).toString("ascii")];
  for (let offset = 16; offset + 4 <= boxEnd; offset += 4) brands.push(buffer.subarray(offset, offset + 4).toString("ascii"));
  return brands.some((brand) => ["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand));
}
function looksValid(buffer: Buffer, extension: string) { if (extension === ".pdf") return buffer.subarray(0, 5).toString() === "%PDF-"; if ([".png"].includes(extension)) return buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"; if ([".jpg", ".jpeg"].includes(extension)) return buffer[0] === 0xff && buffer[1] === 0xd8; if ([".tif", ".tiff"].includes(extension)) { const signature = buffer.subarray(0, 4).toString("hex"); return signature === "49492a00" || signature === "4d4d002a"; } if ([".heic", ".heif"].includes(extension)) return looksLikeHeic(buffer); if ([".docx", ".xlsx", ".pptx"].includes(extension)) return buffer[0] === 0x50 && buffer[1] === 0x4b; if ([".doc", ".xls", ".ppt"].includes(extension)) return buffer.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1"; return false; }

async function run(command: string, args: string[], timeoutMs = 120_000, signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Conversion was canceled.");
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin", HOME: tmpdir(), LANG: "C.UTF-8", LC_ALL: "C.UTF-8" },
      shell: false,
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
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error); else resolve(stdout);
    };
    const stop = (error: Error) => {
      if (settled || terminalError) return;
      terminalError = error;
      child.kill("SIGKILL");
      stopFallback = setTimeout(() => finish(error), 5_000);
      stopFallback.unref();
    };
    const onAbort = () => stop(new Error("Conversion was canceled."));
    const timer = setTimeout(() => stop(new Error("Conversion timed out. Try a smaller or simpler file.")), timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    child.stdout.on("data", (chunk: Buffer) => { if (stdout.length < 16_000) stdout += chunk.toString().slice(0, 16_000 - stdout.length); });
    child.stderr.on("data", (chunk: Buffer) => { if (stderr.length < 2_000) stderr += chunk.toString().slice(0, 2_000 - stderr.length); });
    child.once("error", (error: NodeJS.ErrnoException) => finish(error.code === "ENOENT" ? new Error(`Required converter '${command}' is not installed on this server.`) : new Error("The converter could not be started.")));
    child.once("close", (code) => {
      if (terminalError) { finish(terminalError); return; }
      finish(code === 0 ? undefined : new Error(`The converter rejected this file${stderr ? "." : ` (status ${code}).`}`));
    });
  });
}

async function pdfText(input: string, output: string, signal?: AbortSignal) { await run(process.env.PDFTOTEXT_PATH || "pdftotext", ["-layout", "-nopgbrk", input, output], 120_000, signal); return readFile(output, "utf8"); }
async function renderPdf(input: string, directory: string, format: "png" | "jpg" | "tiff", signal?: AbortSignal) { const prefix = path.join(directory, "page"); const fileExtension = format === "png" ? ".png" : format === "tiff" ? ".tif" : ".jpg"; const args = format === "png" ? ["-png", "-r", "150", input, prefix] : format === "tiff" ? ["-tiff", "-r", "150", input, prefix] : ["-jpeg", "-r", "150", "-jpegopt", "quality=88", input, prefix]; await run(process.env.PDFTOPPM_PATH || "pdftoppm", args, 120_000, signal); return (await readdir(directory)).filter((name) => name.startsWith("page-") && name.endsWith(fileExtension)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((name) => path.join(directory, name)); }
async function officeToPdf(input: string, directory: string, signal?: AbortSignal) { await run(process.env.LIBREOFFICE_PATH || "libreoffice", ["--headless", "--nologo", "--nolockcheck", "--nodefault", "--nofirststartwizard", "--convert-to", "pdf", "--outdir", directory, input], 120_000, signal); const result = (await readdir(directory)).find((name) => name.toLowerCase().endsWith(".pdf")); if (!result) throw new Error("The office converter did not produce a PDF. The file may be corrupt or password-protected."); return path.join(directory, result); }
async function imagesToPdf(files: string[], output: string, extension: ".jpg" | ".png") { const pdf = await PDFDocument.create(); for (const file of files) { const bytes = await readFile(file), image = extension === ".png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes); const maxWidth = 595, maxHeight = 842, scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1), width = image.width * scale, height = image.height * scale; const page = pdf.addPage([Math.max(width, 72), Math.max(height, 72)]); page.drawImage(image, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height }); } await writeFile(output, await pdf.save()); }
async function heicToJpg(input: string, output: string, signal?: AbortSignal) {
  const info = await run(process.env.HEIF_INFO_PATH || "heif-info", [input], 30_000, signal);
  const images = Array.from(
    info.matchAll(/^image:\s+(\d{1,6})x(\d{1,6})\s+\(id=\d+\)(?:,\s*primary)?\s*$/gm),
    (match) => ({ width: Number(match[1]), height: Number(match[2]), primary: /,\s*primary\s*$/.test(match[0]) }),
  );
  if (!images.length) throw new Error("The HEIC file does not contain a readable image.");
  if (images.length !== 1 || !images[0].primary) throw new Error("Choose a HEIC file that contains one primary photo.");
  const [{ width, height }] = images;
  if (width <= 0 || height <= 0 || width * height > 40_000_000) throw new Error("The HEIC image exceeds the 40 megapixel limit.");
  await run(process.env.HEIF_CONVERT_PATH || "heif-convert", ["--quiet", "-q", "90", input, output], 120_000, signal);
  const jpeg = await readFile(output);
  if (!looksValid(jpeg, ".jpg")) throw new Error("The HEIC converter did not produce a valid JPG image.");
  if (jpeg.length > 50 * 1024 * 1024) throw new Error("The converted JPG is larger than the 50 MB output limit.");
}
async function jpgToHeic(input: string, output: string, signal?: AbortSignal) {
  await run(process.env.HEIF_ENC_PATH || "heif-enc", ["-q", "88", "-o", output, input], 120_000, signal);
  const heic = await readFile(output);
  if (!looksLikeHeic(heic)) throw new Error("The converter did not produce a valid HEIC image. This server may not support HEIC encoding.");
  if (heic.length > 50 * 1024 * 1024) throw new Error("The converted HEIC is larger than the 50 MB output limit.");
}
async function tiffToPdf(files: string[], output: string, signal?: AbortSignal) {
  const pdf = await PDFDocument.create();
  let pagesAdded = 0;
  for (const file of files) {
    if (signal?.aborted) throw new Error("Conversion was canceled.");
    const metadata = await sharp(file, { limitInputPixels: 60_000_000 }).metadata();
    const pageTotal = metadata.pages && metadata.pages > 1 ? metadata.pages : 1;
    for (let page = 0; page < pageTotal; page += 1) {
      if (signal?.aborted) throw new Error("Conversion was canceled.");
      pagesAdded += 1;
      if (pagesAdded > 50) throw new Error("The TIFF files contain more than 50 pages combined. Split them and try again.");
      const png = await sharp(file, { page, limitInputPixels: 60_000_000 }).png().toBuffer();
      const image = await pdf.embedPng(png);
      const maxWidth = 595, maxHeight = 842, scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const width = image.width * scale, height = image.height * scale;
      const pdfPage = pdf.addPage([Math.max(width, 72), Math.max(height, 72)]);
      pdfPage.drawImage(image, { x: (pdfPage.getWidth() - width) / 2, y: (pdfPage.getHeight() - height) / 2, width, height });
    }
  }
  if (!pagesAdded) throw new Error("No readable images were found in the TIFF file.");
  await writeFile(output, await pdf.save());
}

export async function convertFiles(conversion: ConversionName, uploads: File[], signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Conversion was canceled.");
  const rule = rules[conversion]; if (!uploads.length) throw new Error("Choose a file to convert."); if (!rule.multiple && uploads.length !== 1) throw new Error("This converter accepts one file at a time."); if (uploads.length > 20) throw new Error("A maximum of 20 images can be combined at once.");
  const total = uploads.reduce((sum, file) => sum + file.size, 0); if (total > 20 * 1024 * 1024) throw new Error("The total upload is larger than the 20 MB limit.");
  const directory = await mkdtemp(path.join(tmpdir(), "figimi-"));
  try {
    const inputs: string[] = [];
    for (const [index, upload] of uploads.entries()) { if (signal?.aborted) throw new Error("Conversion was canceled."); const extension = path.extname(upload.name).toLowerCase(); if (!rule.extensions.includes(extension)) throw new Error(`Unsupported file type. Choose: ${rule.extensions.join(", ")}.`); const data = Buffer.from(await upload.arrayBuffer()); if (signal?.aborted) throw new Error("Conversion was canceled."); if (!looksValid(data, extension)) throw new Error(`${upload.name} appears corrupt or does not match its file extension.`); const input = path.join(directory, `input-${index}${extension}`); await writeFile(input, data); inputs.push(input); }
    if (signal?.aborted) throw new Error("Conversion was canceled.");
    const base = safeBase(uploads[0].name); let output: string; let downloadName: string;
    if (conversion === "heic-to-jpg") { output = path.join(directory, `${base}.jpg`); await heicToJpg(inputs[0], output, signal); downloadName = `${base}.jpg`; }
    else if (conversion === "jpg-to-heic") { output = path.join(directory, `${base}.heic`); await jpgToHeic(inputs[0], output, signal); downloadName = `${base}.heic`; }
    else if (conversion === "tiff-to-pdf") { output = path.join(directory, `${base}.pdf`); await tiffToPdf(inputs, output, signal); downloadName = `${base}.pdf`; }
    else if (conversion === "jpg-to-pdf" || conversion === "png-to-pdf") { output = path.join(directory, `${base}.pdf`); await imagesToPdf(inputs, output, conversion === "png-to-pdf" ? ".png" : ".jpg"); downloadName = `${base}.pdf`; }
    else if (["word-to-pdf", "excel-to-pdf", "ppt-to-pdf"].includes(conversion)) { output = await officeToPdf(inputs[0], directory, signal); downloadName = `${base}.pdf`; }
    else if (conversion === "pdf-to-word") { const text = await pdfText(inputs[0], path.join(directory, "source.txt"), signal); if (!text.trim()) throw new Error("No selectable text was found. This PDF may contain scanned images and require OCR."); const document = new Document({ sections: [{ children: text.split(/\r?\n/).map((line) => new Paragraph(line)) }] }); output = path.join(directory, `${base}.docx`); await writeFile(output, await Packer.toBuffer(document)); downloadName = `${base}.docx`; }
    else if (conversion === "pdf-to-excel") { const text = await pdfText(inputs[0], path.join(directory, "source.txt"), signal); if (!text.trim()) throw new Error("No selectable text was found. Scanned PDFs require OCR before table extraction."); const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("Extracted PDF"); text.split(/\r?\n/).filter(Boolean).forEach((line) => sheet.addRow(line.trim().split(/\s{2,}/))); sheet.columns.forEach((column) => { column.width = Math.min(50, Math.max(12, ...(column.values as unknown[]).map((value) => String(value || "").length + 2))); }); output = path.join(directory, `${base}.xlsx`); await workbook.xlsx.writeFile(output); downloadName = `${base}.xlsx`; }
    else if (conversion === "pdf-to-ppt") { const pages = await renderPdf(inputs[0], directory, "jpg", signal); if (!pages.length) throw new Error("No PDF pages could be rendered."); const pptx = new PptxGenJS(); pptx.layout = "LAYOUT_WIDE"; pages.forEach((page) => { const slide = pptx.addSlide(); slide.addImage({ path: page, x: 0, y: 0, w: 13.333, h: 7.5 }); }); output = path.join(directory, `${base}.pptx`); await pptx.writeFile({ fileName: output }); downloadName = `${base}.pptx`; }
    else { const format = conversion === "pdf-to-png" ? "png" : conversion === "pdf-to-tiff" ? "tiff" : "jpg", fileExtension = format === "png" ? "png" : format === "tiff" ? "tif" : "jpg", pages = await renderPdf(inputs[0], directory, format, signal); if (!pages.length) throw new Error("No PDF pages could be rendered."); const zip = new JSZip(); for (const [index, page] of pages.entries()) zip.file(`page-${index + 1}.${fileExtension}`, await readFile(page)); output = path.join(directory, `${base}-${format}.zip`); await writeFile(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } })); downloadName = `${base}-${format}.zip`; }
    const extension = path.extname(downloadName).toLowerCase(), data = await readFile(output); return { data, downloadName, contentType: mimeByExtension[extension] || "application/octet-stream" };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
