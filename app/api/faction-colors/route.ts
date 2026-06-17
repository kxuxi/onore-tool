import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeErrorResponse } from "@/lib/apiError";
import { requireAdmin } from "@/lib/authGuard";
import type { FactionColorMap } from "@/lib/factionColors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const errorResponse = makeErrorResponse("api/faction-colors");

export async function GET() {
  try {
    const rows = await prisma.factionColor.findMany();
    const map: FactionColorMap = {};
    for (const r of rows) map[r.faction] = r.color;
    return NextResponse.json(map);
  } catch (err) {
    return errorResponse("GET", err);
  }
}

export async function PUT(req: Request) {
  try {
    const denied = requireAdmin();
    if (denied) return denied;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "不正なJSONです" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "オブジェクトが必要です" }, { status: 400 });
    }
    const map = body as Record<string, unknown>;

    // #RRGGBB 形式のみ受け付ける
    const entries = Object.entries(map).filter(
      ([k, v]) =>
        typeof k === "string" &&
        k.length > 0 &&
        typeof v === "string" &&
        /^#[0-9A-Fa-f]{6}$/.test(v)
    ) as [string, string][];

    await prisma.factionColor.deleteMany();
    if (entries.length > 0) {
      await prisma.factionColor.createMany({
        data: entries.map(([faction, color]) => ({ faction, color })),
      });
    }

    const result: FactionColorMap = Object.fromEntries(entries);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse("PUT", err);
  }
}
