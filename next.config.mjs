/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // クライアント側ルーティング（履歴API）でスラッグURLを使うため、
  // 物理ルート・APIルート・静的ファイルのいずれにも一致しなかったパスだけ
  // ルート（app/page.tsx のシェル）へ書き換えて配信する（SPA フォールバック）。
  // fallback は filesystem / 動的ルートの後に評価されるため /api や /_next を妨げない。
  async rewrites() {
    return {
      fallback: [{ source: "/:path*", destination: "/" }],
    };
  },
};

export default nextConfig;
