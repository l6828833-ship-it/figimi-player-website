"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { deleteDevice, expireNow, extendSubscription, setBlocked, setLifetime, setNotes } from "@/lib/iptv/admin-devices";

const text = (form: FormData, name: string) => String(form.get(name) || "").trim();
const fail = (error: unknown, fallback: string) =>
  redirect(`/admin/devices?error=${encodeURIComponent(error instanceof Error ? error.message : fallback)}`);

export async function extendSubscriptionAction(form: FormData) {
  await requireAdmin();
  const mac = text(form, "mac");
  const months = Number(text(form, "months"));
  try {
    await extendSubscription(mac, months);
  } catch (error) {
    fail(error, "Could not extend the subscription.");
  }
  revalidatePath("/admin/devices");
  redirect(`/admin/devices?extended=${encodeURIComponent(String(months))}`);
}

export async function setLifetimeAction(form: FormData) {
  await requireAdmin();
  try {
    await setLifetime(text(form, "mac"));
  } catch (error) {
    fail(error, "Could not set lifetime access.");
  }
  revalidatePath("/admin/devices");
  redirect("/admin/devices?lifetime=1");
}

export async function expireNowAction(form: FormData) {
  await requireAdmin();
  try {
    await expireNow(text(form, "mac"));
  } catch (error) {
    fail(error, "Could not end the subscription.");
  }
  revalidatePath("/admin/devices");
  redirect("/admin/devices?expired=1");
}

export async function setBlockedAction(form: FormData) {
  await requireAdmin();
  const blocked = text(form, "blocked") === "true";
  try {
    await setBlocked(text(form, "mac"), blocked);
  } catch (error) {
    fail(error, "Could not change the block state.");
  }
  revalidatePath("/admin/devices");
  redirect(`/admin/devices?${blocked ? "blocked" : "unblocked"}=1`);
}

export async function deleteDeviceAction(form: FormData) {
  await requireAdmin();
  try {
    await deleteDevice(text(form, "mac"));
  } catch (error) {
    fail(error, "Could not delete the device.");
  }
  revalidatePath("/admin/devices");
  redirect("/admin/devices?deleted=1");
}

export async function setNotesAction(form: FormData) {
  await requireAdmin();
  try {
    await setNotes(text(form, "mac"), text(form, "notes"));
  } catch (error) {
    fail(error, "Could not save the note.");
  }
  revalidatePath("/admin/devices");
  redirect("/admin/devices?noted=1");
}
