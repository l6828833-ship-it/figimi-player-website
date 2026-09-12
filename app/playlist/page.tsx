import type { Metadata } from "next";
import { DevicePlaylistManager } from "@/components/device-playlist-manager";
import { IptvFooter, IptvHeader } from "@/components/iptv-chrome";

export const metadata: Metadata = {
  title: "My playlists",
  description: "Sign in with your Figimi Android TV MAC address and 6-digit key to manage your playlists and subscription.",
  robots: { index: false, follow: false },
};

export default function PlaylistPage() {
  return <>
    <IptvHeader />
    <main className="fp-page">
      <div className="fp-shell">
        <div className="fp-page-head">
          <span className="fp-eyebrow">Figimi device panel</span>
          <h1>My playlists</h1>
          <p>Check your subscription, then add or manage the playlists your Android TV loads.</p>
        </div>
        <DevicePlaylistManager />
      </div>
    </main>
    <IptvFooter />
  </>;
}
