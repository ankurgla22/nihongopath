import { ImageResponse } from "next/og";

/**
 * Square site icon, served at /icon (Next's file convention also emits the <link rel="icon">).
 * Referenced as Organization.logo in JSON-LD: knowledge panels want a square logo, and the
 * 1200×630 social image that used to fill that role is the wrong shape for it.
 * Same mark as the header: the 道 character on the accent gradient.
 */
export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 112,
          background: "linear-gradient(135deg, #c8372d 0%, #b02f26 100%)",
          color: "white",
          fontSize: 300,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        道
      </div>
    ),
    size
  );
}
