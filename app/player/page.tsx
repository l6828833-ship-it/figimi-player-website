import type { Metadata } from "next";
import { IptvPlayer } from "@/components/iptv-player";

export const metadata: Metadata = {
  title: "Player | Figimi IPTV",
  robots: { index: false, follow: false },
};

export default function PlayerPage() {
  return <IptvPlayer />;
}
