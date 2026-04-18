import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "WireGuard Manager";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Grid pattern background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Glow */}
        <div
          style={{
            position: "absolute",
            width: "600px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Icon circle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: "rgba(99,102,241,0.15)",
            border: "2px solid rgba(99,102,241,0.4)",
            marginBottom: "32px",
            zIndex: 1,
          }}
        >
          {/* WireGuard shield icon (SVG inline) */}
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#818cf8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: "bold",
            color: "#f1f5f9",
            letterSpacing: "-1px",
            zIndex: 1,
            marginBottom: "16px",
          }}
        >
          WireGuard Manager
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "28px",
            color: "#94a3b8",
            zIndex: 1,
            marginBottom: "48px",
          }}
        >
          Professional VPN Management Interface
        </div>

        {/* Badges */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            zIndex: 1,
          }}
        >
          {["Secure", "Fast", "Open Source"].map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 20px",
                borderRadius: "999px",
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.35)",
                color: "#a5b4fc",
                fontSize: "20px",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
