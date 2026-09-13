import { NextRequest, NextResponse } from "next/server";
import { verifyIpnSignature, PAID_STATUSES } from "@/lib/nowpayments";

/**
 * NOWPayments IPN (Instant Payment Notification) webhook
 * This endpoint is called by NOWPayments when a payment status changes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signature = request.headers.get("x-nowpayments-sig") || undefined;

    // Verify webhook signature
    if (!verifyIpnSignature(body, signature)) {
      console.warn("[IPN] Signature verification failed");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const paymentStatus: string = body.payment_status || "";
    const orderId: string = body.order_id || "";
    const paymentId: string = body.payment_id || "";

    console.log("[IPN] Received payment notification:", {
      orderId,
      paymentId,
      status: paymentStatus,
    });

    // Handle payment status
    if (PAID_STATUSES.has(paymentStatus)) {
      console.log("[IPN] Payment confirmed:", orderId);
      
      // TODO: Update your database here
      // Parse orderId to get deviceMac and planId
      // Update device subscription in Supabase
      // Example:
      // const [deviceMac, planId] = orderId.split('-');
      // await updateDeviceSubscription(deviceMac, planId);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[IPN] Processing error:", error);
    return NextResponse.json(
      { error: "IPN processing failed" },
      { status: 500 }
    );
  }
}
