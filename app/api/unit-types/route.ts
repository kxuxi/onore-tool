import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeErrorResponse } from "@/lib/apiError";
import { requireAdmin } from "@/lib/authGuard";
import type { UnitType } from "@/lib/types";

export const dynamic = "force-dynamic";

const errorResponse = makeErrorResponse("api/unit-types");

function normalize(body: Partial<UnitType>): Omit<UnitType, "name"> {
  return {
    category: (body.category ?? "").toString(),
    goodAgainst: (body.goodAgainst ?? "").toString(),
    attack: Number(body.attack ?? 0) || 0,
    defense: Number(body.defense ?? 0) || 0,
    cost: (body.cost ?? "").toString(),
    tech: (body.tech ?? "").toString(),
    years: (body.years ?? "").toString(),
    reqStats: (body.reqStats ?? "").toString(),
    facility: (body.facility ?? "").toString(),
    special: (body.special ?? "").toString(),
    bonus: (body.bonus ?? "").toString(),
  };
}

export async function GET() {
  try {
    const rows = await prisma.unitType.findMany({
      orderBy: { id: "asc" },
    });
    const list: UnitType[] = rows.map((r) => ({
      name: r.name,
      category: r.category,
      goodAgainst: r.goodAgainst,
      attack: r.attack,
      defense: r.defense,
      cost: r.cost,
      tech: r.tech,
      years: r.years,
      reqStats: r.reqStats,
      facility: r.facility,
      special: r.special,
      bonus: r.bonus,
    }));
    return NextResponse.json(list);
  } catch (err) {
    return errorResponse("GET", err);
  }
}

// 兵種を upsert（名前が被ったら上書き、無ければ追加）
export async function POST(req: Request) {
  try {
    const denied = requireAdmin();
    if (denied) return denied;
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json(
        { error: "リクエストボディが不正な JSON です" },
        { status: 400 }
      );
    }
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json(
        { error: "リクエストボディはオブジェクトである必要があります" },
        { status: 400 }
      );
    }
    const body = raw as Partial<UnitType>;
    const name = (body.name ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "name は必須です" }, { status: 400 });
    }
    const data = normalize(body);
    const row = await prisma.unitType.upsert({
      where: { name },
      create: { name, ...data },
      update: data,
    });
    return NextResponse.json(row);
  } catch (err) {
    return errorResponse("POST", err);
  }
}
