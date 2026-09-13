"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createDevice, deleteDevice, expireNow, extendDays, extendSubscription, setBlocked, setLabel, setLifetime, setNotes } from "@/lib/iptv/admin-devices";

const text = (form: FormData, name: string) => String(form.get(name) || "").trim();

/**
 * Where to land after the action. Every form carries the page it was submitted from so
 * the same action serves both the devices list and a single device page without the
 * operator being bounced back to the top of the list after each click.
 */
function target(form: FormData): string {
  const back = text(form, "back");
  return back.startsWith("/admin/devices") ? back : "/admin/devices";
}

const done = (form: FormData, query: string) => {
  const to = target(form);
  revalidatePath("/admin/devices");
  revalidatePath(to);
  redirect(`${to}?${query}`);
};

const fail = (form: FormData, error: unknown, fallback: string) =>
  redirect(`${target(form)}?error=${encodeURIComponent(error instanceof Error ? error.message : fallback)}`);

/**
 * One action behind the extend stepper, in months or days.
 *
 * It only ever adds time. Reducing a term stays on "End now", so a mistyped number can
 * never quietly cut a paying customer short.
 */
export async function extendTermAction(form: FormData) {
  await requireAdmin();
  const amount = Number(text(form, "amount"));
  const unit = text(form, "unit") === "days" ? "days" : "months";
  try {
    if (unit === "days") await extendDays(text(form, "mac"), amount);
    else await extendSubscription(text(form, "mac"), amount);
  } catch (error) {
    fail(form, error, "Could not extend the subscription.");
  }
  done(form, `${unit === "days" ? "days" : "extended"}=${encodeURIComponent(String(amount))}`);
}

export async function setLifetimeAction(form: FormData) {
  await requireAdmin();
  try {
    await setLifetime(text(form, "mac"));
  } catch (error) {
    fail(form, error, "Could not set lifetime access.");
  }
  done(form, "lifetime=1");
}

export async function expireNowAction(form: FormData) {
  await requireAdmin();
  try {
    await expireNow(text(form, "mac"));
  } catch (error) {
    fail(form, error, "Could not end the subscription.");
  }
  done(form, "expired=1");
}

export async function setBlockedAction(form: FormData) {
  await requireAdmin();
  const blocked = text(form, "blocked") === "true";
  try {
    await setBlocked(text(form, "mac"), blocked);
  } catch (error) {
    fail(form, error, "Could not change the block state.");
  }
  done(form, `${blocked ? "blocked" : "unblocked"}=1`);
}

export async function deleteDeviceAction(form: FormData) {
  await requireAdmin();
  try {
    await deleteDevice(text(form, "mac"));
  } catch (error) {
    fail(form, error, "Could not delete the device.");
  }
  // A deleted device has no page left to return to.
  revalidatePath("/admin/devices");
  redirect("/admin/devices?deleted=1");
}

export async function setNotesAction(form: FormData) {
  await requireAdmin();
  try {
    await setNotes(text(form, "mac"), text(form, "notes"));
  } catch (error) {
    fail(form, error, "Could not save the note.");
  }
  done(form, "noted=1");
}

export async function setLabelAction(form: FormData) {
  await requireAdmin();
  try {
    await setLabel(text(form, "mac"), text(form, "label"));
  } catch (error) {
    fail(form, error, "Could not save the customer name.");
  }
  done(form, "labelled=1");
}

export async function createDeviceAction(form: FormData) {
  await requireAdmin();
  const months = Number(text(form, "months") || "0");
  let mac = "";
  try {
    mac = await createDevice(text(form, "mac"), months, text(form, "label"));
  } catch (error) {
    fail(form, error, "Could not add the device.");
  }
  revalidatePath("/admin/devices");
  redirect(`/admin/devices/${mac.replace(/:/g, "-")}?created=1`);
}
