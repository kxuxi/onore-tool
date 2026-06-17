import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FEATURES = [
  "戦闘履歴登録",
  "武将ランキング",
  "兵種図鑑",
  "戦績詳細",
];

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
            padding: "64px",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "22px",
              width: "58%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 16px",
                borderRadius: "999px",
                background: "rgba(106, 169, 255, 0.14)",
                border: "1px solid rgba(106, 169, 255, 0.36)",
                color: "#b8d6ff",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.02em",
                alignSelf: "flex-start",
              }}
            >
              己鯖 武将DB
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                style={{
                  fontSize: 76,
                  lineHeight: 1,
                  fontWeight: 900,
                  letterSpacing: "0.04em",
                }}
              >
                ONORE ANALYTICS
              </div>
              <div
                style={{
                  fontSize: 28,
                  lineHeight: 1.35,
                  color: "rgba(245, 247, 255, 0.78)",
                  maxWidth: 760,
                }}
              >
                戦闘履歴から、武将の動きがすぐ分かる。
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "14px",
                width: "100%",
                maxWidth: 560,
              }}
            >
              {FEATURES.map((feature, index) => (
                <div
                  key={feature}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: 270,
                    flexGrow: 1,
                    padding: "16px 18px",
                    borderRadius: 18,
                    background:
                      index % 2 === 0
                        ? "rgba(106, 169, 255, 0.14)"
                        : "rgba(255, 196, 94, 0.12)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  <span>{feature}</span>
                  <span style={{ color: "rgba(245, 247, 255, 0.5)" }}>→</span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              width: 340,
              height: 340,
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
                width: 58,
                height: 58,
                borderRadius: "50%",
                background: "#6aa9ff",
                boxShadow: "0 0 0 12px rgba(106, 169, 255, 0.16)",
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}