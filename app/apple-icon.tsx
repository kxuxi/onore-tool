import { ImageResponse } from "next/og";

/**
 * iOS のホーム画面追加用アイコン（apple-touch-icon）。
 * iOS は SVG を apple-touch-icon として扱えないため、ブランドのモノグラム
 * （ダーク地＋アクセントのリングと中心点）を 180×180 PNG として生成する。
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f1115",
        }}
      >
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: "50%",
            border: "20px solid #6aa9ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#6aa9ff",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
