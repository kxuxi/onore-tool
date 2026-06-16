// 管理者ユーザーを作成 / 更新するスクリプト。
//   npm run create-admin -- <ユーザー名> <パスワード>
// 既存の同名ユーザーがいればパスワードを更新します（upsert）。
//
// このスクリプトは `tsx` で直接実行されるため、prisma.config.ts は読み込まれません。
// そのため先頭で dotenv を読み込み、.env の DATABASE_URL を反映します。
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];
  if (!username || !password) {
    console.error("使い方: npm run create-admin -- <ユーザー名> <パスワード>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("パスワードは8文字以上にしてください。");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = hashPassword(password);
    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, passwordHash },
    });
    console.log(`管理者ユーザーを保存しました: ${user.username} (id=${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
