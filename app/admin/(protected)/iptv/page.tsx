import { createAdminClient } from "@/lib/supabase/admin";
import { deleteDevicePlaylistAction, setDevicePlaylistEnabledAction } from "../../iptv/actions";

type SearchParams = Promise<{ error?: string; deviceUpdated?: string; deviceDeleted?: string }>;

export default async function IptvAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Deliberately selects no secret columns: playlist sources, Xtream credentials, and
  // access tokens must never reach the admin browser.
  const { data: devicePlaylists } = await createAdminClient()
    .from("iptv_device_playlists")
    .select("id,device_mac,name,source_type,enabled,access_count,last_accessed_at,created_at")
    .order("created_at", { ascending: false });
  const { data: devices } = await createAdminClient()
    .from("iptv_devices")
    .select("device_mac,login_count,last_login_at,locked_until,disabled")
    .order("last_login_at", { ascending: false })
    .limit(50);

  return <>
    <div className="admin-heading"><div><span className="eyebrow">IPTV control room</span><h1>Device playlists</h1><p>Playlists that TV owners added at <code>/playlist</code> using their MAC address and 6-digit key.</p></div></div>
    {params.error && <div className="notice error">{params.error}</div>}
    {params.deviceUpdated && <div className="notice success">Playlist status updated.</div>}
    {params.deviceDeleted && <div className="notice success">Playlist deleted.</div>}

    <section className="admin-card"><h2>Playlists</h2>{!devicePlaylists?.length ? <p>No device playlists yet.</p> : <div className="admin-table"><table><thead><tr><th>Device MAC</th><th>Name</th><th>Source</th><th>Usage</th><th>Status</th><th>Actions</th></tr></thead><tbody>{devicePlaylists.map((playlist) => <tr key={playlist.id}><td><strong>{playlist.device_mac}</strong></td><td>{playlist.name}</td><td>{playlist.source_type === "url" ? "M3U link" : playlist.source_type === "xtream" ? "Xtream login" : "Uploaded M3U"}</td><td>{playlist.access_count.toLocaleString()} TV requests<br /><small>{playlist.last_accessed_at ? `Last used ${new Date(playlist.last_accessed_at).toLocaleString()}` : "Not used yet"}</small></td><td><span className={`status ${playlist.enabled ? "published" : ""}`}>{playlist.enabled ? "enabled" : "disabled"}</span></td><td><div className="admin-inline-actions"><form action={setDevicePlaylistEnabledAction}><input type="hidden" name="id" value={playlist.id} /><input type="hidden" name="enabled" value={String(!playlist.enabled)} /><button className="button small secondary" type="submit">{playlist.enabled ? "Disable" : "Enable"}</button></form><form action={deleteDevicePlaylistAction}><input type="hidden" name="id" value={playlist.id} /><button className="button small danger" type="submit">Delete</button></form></div></td></tr>)}</tbody></table></div>}</section>

    <section className="admin-card"><h2>Recent device sign-ins</h2>{!devices?.length ? <p>No devices have signed in yet.</p> : <div className="admin-table"><table><thead><tr><th>Device MAC</th><th>Sign-ins</th><th>Last sign-in</th><th>State</th></tr></thead><tbody>{devices.map((device) => <tr key={device.device_mac}><td><strong>{device.device_mac}</strong></td><td>{device.login_count.toLocaleString()}</td><td>{device.last_login_at ? new Date(device.last_login_at).toLocaleString() : "Never"}</td><td>{device.disabled ? <span className="status">disabled</span> : device.locked_until && new Date(device.locked_until) > new Date() ? <span className="status scheduled">locked</span> : <span className="status published">active</span>}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
