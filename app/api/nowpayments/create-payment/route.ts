import { NextRequest, NextResponse } from "next/server";
import { createPayment } from "@/lib/nowpayments";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceMac, planId, amount, payCurrency } = body;

    if (!deviceMac || !planId || !amount || !payCurrency) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const payment = await createPayment({
      deviceMac,
      planId,
      amount: Number(amount),
      payCurrency,
    });

    return NextResponse.json({ payment });
  } catch (error: any) {
    console.error("[API] Create payment error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create payment" },
      { status: 500 }
    );
  }
}
