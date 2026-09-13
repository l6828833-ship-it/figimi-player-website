"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { addPayment, deletePayment, setPaymentStatus } from "@/lib/iptv/payments";

const text = (form: FormData, name: string) => String(form.get(name) || "").trim();

function target(form: FormData): string {
  const back = text(form, "back");
  return back.startsWith("/admin/") ? back : "/admin/payments";
}

const fail = (form: FormData, error: unknown, fallback: string) =>
  redirect(`${target(form)}?error=${encodeURIComponent(error instanceof Error ? error.message : fallback)}`);

const done = (form: FormData, query: string) => {
  const to = target(form);
  revalidatePath("/admin/payments");
  revalidatePath("/admin/devices");
  revalidatePath(to);
  redirect(`${to}?${query}`);
};

export async function addPaymentAction(form: FormData) {
  await requireAdmin();
  try {
    await addPayment({
      mac: text(form, "mac"),
      amount: Number(text(form, "amount")),
      currency: text(form, "currency") || "USD",
      method: text(form, "method") || "cash",
      months: Number(text(form, "months") || "0"),
      status: text(form, "status") || "paid",
      reference: text(form, "reference"),
      note: text(form, "note"),
      paidAt: text(form, "paidAt") || undefined,
      // Checked by default in the form: taking money and granting the term are the
      // same action for the operator.
      extend: text(form, "extend") === "on",
    });
  } catch (error) {
    fail(form, error, "Could not record the payment.");
  }
  done(form, "paid=1");
}

export async function setPaymentStatusAction(form: FormData) {
  await requireAdmin();
  try {
    await setPaymentStatus(text(form, "id"), text(form, "status"));
  } catch (error) {
    fail(form, error, "Could not update the payment.");
  }
  done(form, "updated=1");
}

export async function deletePaymentAction(form: FormData) {
  await requireAdmin();
  try {
    await deletePayment(text(form, "id"));
  } catch (error) {
    fail(form, error, "Could not delete the payment.");
  }
  done(form, "removed=1");
}
