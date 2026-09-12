import type { Metadata } from "next";
import Link from "next/link";
import { DevicePlaylistManager } from "@/components/device-playlist-manager";

export const metadata: Metadata = {
  title: "Manage Android TV playlist",
  description: "Sign in with your Figimi Android TV MAC address and 6-digit key to manage M3U link or Xtream playlists.",
  robots: { index: false, follow: false },
};

export default function PlaylistPage() {
  return <div className="playlist-page"><header className="playlist-page-header"><Link href="/" className="playlist-brand">Figimi <span>IPTV</span></Link><Link href="/" className="button secondary">Back to Figimi</Link></header><main className="playlist-page-main"><div className="playlist-page-heading"><span className="eyebrow">Figimi device management</span><h1>Your playlist dashboard</h1><p>Sign in with the MAC address and 6-digit key shown on your Android TV, then add your playlist as an M3U link or an Xtream login.</p></div><DevicePlaylistManager /></main></div>;
}
