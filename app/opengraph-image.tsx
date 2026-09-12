import { ImageResponse } from "next/og";

export const alt = "Figimi — Free Online Text, PDF, Image & Color Tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "90px",
          background: "linear-gradient(135deg, #6957d9 0%, #9500ff 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 68, fontWeight: 800, letterSpacing: "-0.03em" }}>Figimi</div>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, lineHeight: 1.2, marginTop: 22, maxWidth: 920 }}>
          Free Online Tools for Text, PDF, Images &amp; Color
        </div>
        <div style={{ display: "flex", fontSize: 27, marginTop: 30, opacity: 0.92 }}>figimi.com</div>
      </div>
    ),
    { ...size }
  );
}
