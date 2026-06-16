import type { MetadataRoute } from "next";

/**
 * Web App Manifest。ホーム画面に追加したときの名称・アイコン・表示モードを定義する。
 * Next.js App Router が `/manifest.webmanifest` として配信する。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ONORE ANALYTICS",
    short_name: "ONORE",
    description:
      "ゲーム「己鯖」の戦闘履歴から武将のタイプ・兵科を登録し、偵察リストから即座に検索できるツール。",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1115",
    theme_color: "#0f1115",
    lang: "ja",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
