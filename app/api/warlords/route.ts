import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeErrorResponse } from "@/lib/apiError";
import { requireAdmin } from "@/lib/authGuard";
import type { Warlord, WarlordMap } from "@/lib/types";

export const dynamic = "force-dynamic";

const errorResponse = makeErrorResponse("api/warlords");

function rowToWarlord(r: {
  name: string;
  household: string | null;
  faction: string | null;
  type: string;
  branch: string;
  unit: string | null;
  battleAt: string | null;
  lastActionAt: string | null;
  lastDefenseAt: string | null;
  actions: string[];
  term: number;
  updatedAt: bigint;
  power: number | null;
  intelligence: number | null;
  leadership: number | null;
  politics: number | null;
  strategy: number | null;
  selfPr: string | null;
  statsRaw: string | null;
}): Warlord {
  return {
    name: r.name,
    household: r.household ?? undefined,
    faction: r.faction ?? undefined,
    type: r.type,
    branch: r.branch,
    unit: r.unit ?? undefined,
    battleAt: r.battleAt ?? undefined,
    lastActionAt: r.lastActionAt ?? undefined,
    lastDefenseAt: r.lastDefenseAt ?? undefined,
    actions: r.actions.length > 0 ? r.actions : undefined,
    term: r.term,
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

/**
 * PATCH /api/warlords
 * プロフィールフィールド（国・タイプ・兵科・兵種・家督名）を直接更新する。
 * バトル順マージを経由せず強制上書きするため、管理者専用。
 */
export async function PATCH(req: Request) {
  try {
    const denied = requireAdmin();
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
    }

    const { name, faction, type, branch, unit, household } = body as Record<string, unknown>;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name は必須です" }, { status: 400 });
    }

    const existing = await prisma.warlord.findUnique({ where: { name } });

    if (existing) {
      await prisma.warlord.update({
        where: { name },
        data: {
          ...(faction !== undefined ? { faction: (faction as string) || null } : {}),
          ...(type !== undefined && typeof type === "string" ? { type } : {}),
          ...(branch !== undefined && typeof branch === "string" ? { branch } : {}),
          ...(unit !== undefined ? { unit: (unit as string) || null } : {}),
          ...(household !== undefined ? { household: (household as string) || null } : {}),
          updatedAt: BigInt(Date.now()),
        },
      });
    } else {
      // 未登録武将を新規作成
      if (!type || typeof type !== "string" || !branch || typeof branch !== "string") {
        return NextResponse.json(
          { error: "新規登録にはタイプと兵科が必要です" },
          { status: 400 }
        );
      }
      await prisma.warlord.create({
        data: {
          name,
          faction: (faction as string) || null,
          type,
          branch,
          unit: (unit as string) || null,
          household: (household as string) || null,
          term: 145,
          actions: [],
          updatedAt: BigInt(Date.now()),
        },
      });
    }

    const rows = await prisma.warlord.findMany();
    const db: WarlordMap = {};
    for (const r of rows) db[r.name] = rowToWarlord(r as Parameters<typeof rowToWarlord>[0]);
    return NextResponse.json({ db });
  } catch (err) {
    return errorResponse("PATCH", err);
  }
}
