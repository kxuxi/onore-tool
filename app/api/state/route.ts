import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeWarlords } from "@/lib/storage";
import { battleKey } from "@/lib/parser";
import type { BattleRecord, Warlord, WarlordMap } from "@/lib/types";

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
  };
}

function warlordToRow(w: Warlord) {
  return {
    name: w.name,
    faction: w.faction ?? null,
    type: w.type,
    branch: w.branch,
    unit: w.unit ?? null,
    battleAt: w.battleAt ?? null,
    lastActionAt: w.lastActionAt ?? null,
    actions: w.actions ?? [],
    updatedAt: BigInt(w.updatedAt),
  };
}

async function loadMap(): Promise<WarlordMap> {
  const rows = await prisma.warlord.findMany();
  const map: WarlordMap = {};
  for (const r of rows as WarlordRow[]) map[r.name] = rowToWarlord(r);
  return map;
}

async function loadLog(): Promise<BattleRecord[]> {
  const rows = await prisma.battleRecord.findMany({
    orderBy: { id: "asc" },
  });
  return rows.map((r) => ({
    line: r.raw || r.line,
    time: r.time ?? undefined,
    savedAt: Number(r.savedAt),
  }));
}

function errorResponse(context: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[api/state] ${context} failed:`, err);
  return NextResponse.json(
    { error: message, context },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const [db, log] = await Promise.all([loadMap(), loadLog()]);
    return NextResponse.json({ db, log });
  } catch (err) {
    return errorResponse("GET", err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      warlords?: Warlord[];
      records?: BattleRecord[];
    };
    const warlords = body.warlords ?? [];
    const records = body.records ?? [];

    // 武将のマージ（既存DBを読み込んでサーバ側で統合）
    const existing = await loadMap();
    const { map, added, updated } = mergeWarlords(existing, warlords);

    const changedNames = new Set(warlords.map((w) => w.name));
    await prisma.$transaction(
      Array.from(changedNames).map((name) => {
        const row = warlordToRow(map[name]);
        const { name: _n, ...rest } = row;
        return prisma.warlord.upsert({
          where: { name },
          create: row,
          update: rest,
        });
      })
    );

    // 戦闘履歴の追加（戦闘の同一性キーをユニークキーにして重複排除）
    let logAdded = 0;
    let skipped = 0;
    if (records.length > 0) {
      const now = Date.now();
      // 入力内の重複もまとめる（ターン数・URL の有無だけが違う同一戦闘も集約）
      const byKey = new Map<string, { raw: string; time?: string }>();
      for (const r of records) {
        const key = battleKey(r.line);
        if (!key) continue;
        if (!byKey.has(key)) byKey.set(key, { raw: r.line, time: r.time });
      }
      const data = Array.from(byKey.entries()).map(([key, v]) => ({
        line: key,
        raw: v.raw,
        time: v.time ?? null,
        savedAt: BigInt(now),
      }));
      const result = await prisma.battleRecord.createMany({
        data,
        skipDuplicates: true,
      });
      logAdded = result.count;
      skipped = data.length - logAdded;
    }

    const [db, log] = await Promise.all([loadMap(), loadLog()]);
    return NextResponse.json({ db, log, added, updated, logAdded, skipped });
  } catch (err) {
    return errorResponse("POST", err);
  }
}

export async function DELETE() {
  try {
    await prisma.$transaction([
      prisma.warlord.deleteMany({}),
      prisma.battleRecord.deleteMany({}),
    ]);
    return NextResponse.json({ db: {}, log: [] });
  } catch (err) {
    return errorResponse("DELETE", err);
  }
}
