"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { deleteDevicePlaylist, setDevicePlaylistEnabled } from "@/lib/iptv/playlists";

const text = (form: FormData, name: string) => String(form.get(name) || "").trim();

/**
 * Admin actions talk to Supabase through the shared server modules rather than an
 * external API, which is what lets the whole site deploy as one project.
 */
export async function setDevicePlaylistEnabledAction(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  const enabled = text(form, "enabled") === "true";
  try {
    await setDevicePlaylistEnabled(id, enabled);
  } catch (error) {
    redirect(`/admin/iptv?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not update the playlist.")}`);
  }
  revalidatePath("/admin/iptv");
  redirect("/admin/iptv?deviceUpdated=1");
}

export async function deleteDevicePlaylistAction(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  try {
    await deleteDevicePlaylist(id);
  } catch (error) {
    redirect(`/admin/iptv?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not delete the playlist.")}`);
  }
  revalidatePath("/admin/iptv");
  redirect("/admin/iptv?deviceDeleted=1");
}
