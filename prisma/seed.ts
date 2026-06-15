import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ヘッダー行に現れる語（兵種名としては存在しない）
const HEADER_TOKENS = new Set(["種類", "兵種", "[%]", "能力値"]);

function isHeaderRow(cols: string[]): boolean {
  const name = cols[0]?.trim() ?? "";
  if (!name) return true;
  if (HEADER_TOKENS.has(name)) return true;
  // 攻撃列が数値でなければヘッダー/不正行とみなす
  const attack = cols[3]?.trim() ?? "";
  if (attack !== "" && Number.isNaN(Number(attack))) return true;
  return false;
}

async function main() {
  const raw = readFileSync(
    join(process.cwd(), "prisma", "raw-user-units.txt"),
    "utf8"
  );
  const lines = raw.split(/\r?\n/);

  let count = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split("\t");
    if (isHeaderRow(cols)) continue;

    const name = cols[0].trim();
    const data = {
      category: (cols[1] ?? "").trim(),
      goodAgainst: (cols[2] ?? "").trim(),
      attack: Number(cols[3] ?? 0) || 0,
      defense: Number(cols[4] ?? 0) || 0,
      cost: (cols[5] ?? "").trim(),
      tech: (cols[6] ?? "").trim(),
      years: (cols[7] ?? "").trim(),
      reqStats: (cols[8] ?? "").trim(),
      facility: (cols[9] ?? "").trim(),
      special: (cols[10] ?? "").trim(),
      bonus: (cols[11] ?? "").trim(),
    };

    await prisma.unitType.upsert({
      where: { name },
      create: { name, ...data },
      update: data,
    });
    count += 1;
  }

  console.log(`Seeded ${count} unit types.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
