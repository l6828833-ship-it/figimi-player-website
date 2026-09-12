import { NextResponse } from "next/server";
import { convertFiles, isConversionName } from "@/lib/conversion";

export const runtime = "nodejs";
export const maxDuration = 180;
const MAX_REQUEST = 21 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ conversion: string }> }) {
  const { conversion } = await params;
  if (!isConversionName(conversion)) return NextResponse.json({ error: "Unknown conversion type." }, { status: 404 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST) return NextResponse.json({ error: "The upload is larger than the 20 MB limit." }, { status: 413 });
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
    const result = await convertFiles(conversion, files, request.signal);
    return new NextResponse(new Uint8Array(result.data), { status: 200, headers: { "Content-Type": result.contentType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.downloadName)}`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conversion failed. The file may be corrupt or unsupported.";
    console.error("Conversion failed", { conversion, message });
    return NextResponse.json({ error: message }, { status: message.includes("20 MB") ? 413 : 422, headers: { "Cache-Control": "no-store" } });
  }
}
