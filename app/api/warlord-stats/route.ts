import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Warlord, WarlordMap } from "@/lib/types";

export const dynamic = "force-dynamic";

type WarlordRow = {
  name: string;
  faction: string | null;
  type: string;
  branch: string;
  unit: string | null;
  battleAt: string | null;
  lastActionAt: string | null;
  actions: string[];
  updatedAt: bigint;
  power: number | null;
  intelligence: number | null;
  leadership: number | null;
  politics: number | null;
  strategy: number | null;
  selfPr: string | null;
  statsRaw: string | null;
};

function rowToWarlord(r: WarlordRow): Warlord {
  return {
    name: r.name,
    faction: r.faction ?? undefined,
    type: r.type,
    branch: r.branch,
    unit: r.unit ?? undefined,
    battleAt: r.battleAt ?? undefined,
    lastActionAt: r.lastActionAt ?? undefined,
    actions: r.actions.length > 0 ? r.actions : undefined,
    updatedAt: Number(r.updatedAt),
    power: r.power ?? undefined,
    intelligence: r.intelligence ?? undefined,
    leadership: r.leadership ?? undefined,
    politics: r.politics ?? undefined,
    strategy: r.strategy ?? undefined,
    selfPr: r.selfPr ?? undefined,
    statsRaw: r.statsRaw ?? undefined,
  };
}

async function loadMap(): Promise<WarlordMap> {
  const rows = (await prisma.warlord.findMany()) as WarlordRow[];
  const map: WarlordMap = {};
  for (const r of rows) map[r.name] = rowToWarlord(r);
  return map;
}

function errorResponse(context: string, err: unknown) {
  console.error(`[api/warlord-stats] ${context} failed:`, err);
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, context }, { status: 500 });
  }
  return NextResponse.json(
    { error: "サーバー内部エラーが発生しました。" },
    { status: 500 }
  );
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

interface StatInput {
  name: string;
  power?: number;
  intelligence?: number;
  leadership?: number;
  politics?: number;
  strategy?: number;
  selfPr?: string;
  faction?: string;
  raw?: string;
}

/** 取り込み能力値の入力を境界で検証する。 */
function parseBody(body: unknown): { stats: StatInput[] } | { error: string } {
  if (!isObject(body)) return { error: "リクエストボディはオブジェクトである必要があります" };
  const stats = body.stats;
  if (!Array.isArray(stats)) return { error: "stats は配列である必要があります" };
  const optionalNumber = (v: unknown) => v === undefined || typeof v === "number";
  for (const s of stats) {
    if (!isObject(s) || typeof s.name !== "string" || !s.name.trim()) {
      return { error: "stats の各要素には name（非空文字列）が必要です" };
    }
    if (
      !optionalNumber(s.power) ||
      !optionalNumber(s.intelligence) ||
      !optionalNumber(s.leadership) ||
      !optionalNumber(s.politics) ||
      !optionalNumber(s.strategy)
    ) {
      return { error: "能力値は数値である必要があります" };
    }
  }
  return { stats: stats as StatInput[] };
}

export async function POST(req: Request) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return badRequest("リクエストボディが不正な JSON です");
    }
    const parsed = parseBody(raw);
    if ("error" in parsed) return badRequest(parsed.error);
    const { stats } = parsed;

    const now = Date.now();
    let updated = 0;
    let created = 0;

    if (stats.length > 0) {
      const existing = await prisma.warlord.findMany({
        where: { name: { in: stats.map((s) => s.name) } },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((e) => e.name));

      await prisma.$transaction(
        stats.map((s) => {
          const statFields = {
            power: s.power ?? null,
            intelligence: s.intelligence ?? null,
            leadership: s.leadership ?? null,
            politics: s.politics ?? null,
            strategy: s.strategy ?? null,
            selfPr: s.selfPr ?? null,
            statsRaw: s.raw ?? null,
          };
          if (existingNames.has(s.name)) updated++;
          else created++;
          return prisma.warlord.upsert({
            where: { name: s.name },
            // 既存武将は能力値・自己PRのみ更新（国・兵科など戦闘由来の情報は保持）。
            update: statFields,
            // 新規武将はランキングの国名を faction に補完して作成。
            create: {
              name: s.name,
              faction: s.faction ?? null,
              type: "",
              branch: "",
              updatedAt: BigInt(now),
              ...statFields,
            },
          });
        })
      );
    }

    const db = await loadMap();
    return NextResponse.json({ db, updated, created });
  } catch (err) {
    return errorResponse("POST", err);
  }
}
