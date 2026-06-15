import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { UnitType } from "@/lib/types";

export const dynamic = "force-dynamic";

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
}

// 兵種を upsert（名前が被ったら上書き、無ければ追加）
export async function POST(req: Request) {
  const body = (await req.json()) as Partial<UnitType>;
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
}
