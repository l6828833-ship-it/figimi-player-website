import { NextResponse } from "next/server";
import { getAvailableCurrencies } from "@/lib/nowpayments";

export async function GET() {
  try {
    const currencies = await getAvailableCurrencies();
    return NextResponse.json({ currencies });
  } catch (error) {
    console.error("[API] Get currencies error:", error);
    return NextResponse.json(
      { error: "Failed to fetch currencies" },
      { status: 500 }
    );
  }
}
