import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus } from "@/lib/nowpayments";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json(
        { error: "Missing paymentId" },
        { status: 400 }
      );
    }

    const status = await getPaymentStatus(paymentId);

    if (!status) {
      return NextResponse.json(
        { error: "Failed to fetch payment status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error("[API] Get payment status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment status" },
      { status: 500 }
    );
  }
}
