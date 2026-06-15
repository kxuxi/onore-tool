// Prisma の設定ファイル（package.json#prisma の後継）。
// 設定ファイルを使うと .env の自動読み込みが無効になるため、
// 先頭で dotenv を読み込み DATABASE_URL などを process.env に展開する。
// （Vercel など .env を使わない環境では no-op で副作用なし）
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    // `prisma db seed` 実行時のコマンド（旧 package.json#prisma.seed の移行先）
    seed: "tsx prisma/seed.ts",
  },
});
