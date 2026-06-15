import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

if (!process.env.DATABASE_URL) {
  // ランタイム（Vercel など）で未設定だと全 API が 500 になる。
  // prisma.config.ts の dotenv は CLI 専用でランタイムには効かないため、
  // ホスティング側の環境変数に DATABASE_URL を設定する必要がある。
  console.error(
    "[prisma] 環境変数 DATABASE_URL が未設定です。デプロイ先（Vercel など）の環境変数に DATABASE_URL を設定してください。"
  );
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
