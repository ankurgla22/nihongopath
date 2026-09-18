import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site";

/**
 * Default social preview image for every route (Next's file convention: this segment-level
 * image is inherited by all nested routes that do not define their own). Also referenced as
 * the Organization logo in JSON-LD.
 */
export const runtime = "edge";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #f7f6f2 0%, #fdeceb 100%)",
          color: "#16151a",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "linear-gradient(135deg, #c8372d 0%, #b02f26 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            道
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 80, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>日本語の道</div>
          <div style={{ fontSize: 34, color: "#3b3a40", maxWidth: 980, lineHeight: 1.3 }}>{SITE_TAGLINE}</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "#6f6d75" }}>
          {["Foundation", "N5", "N4", "N3", "N2", "N1"].map((l) => (
            <div key={l} style={{ padding: "8px 18px", borderRadius: 999, border: "2px solid #e7e4dc", background: "white" }}>
              {l}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
