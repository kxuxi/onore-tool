import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #0f1115 0%, #151c29 46%, #0d2236 100%)",
          color: "#f5f7ff",
          fontFamily:
            'Inter, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif',
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 18%, rgba(106, 169, 255, 0.22), transparent 28%), radial-gradient(circle at 80% 18%, rgba(255, 196, 94, 0.18), transparent 24%), radial-gradient(circle at 82% 82%, rgba(90, 196, 160, 0.18), transparent 24%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "40px",
            borderRadius: "28px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(8, 11, 18, 0.22)",
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.4)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "80px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 28,
            }}
          >
            <div
              style={{
                width: 212,
                height: 212,
                borderRadius: "50%",
                border: "26px solid rgba(106, 169, 255, 0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "radial-gradient(circle at center, rgba(106, 169, 255, 0.12), rgba(106, 169, 255, 0.02) 68%, transparent 69%)",
                boxShadow:
                  "0 0 0 18px rgba(255,255,255,0.03), 0 0 80px rgba(106,169,255,0.22)",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#6aa9ff",
                  boxShadow: "0 0 0 10px rgba(106, 169, 255, 0.16)",
                }}
              />
            </div>

            <div
              style={{
                fontSize: 78,
                lineHeight: 1,
                fontWeight: 900,
                letterSpacing: "0.04em",
                textAlign: "center",
              }}
            >
              ONORE ANALYTICS
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}