import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 兵種を名前で削除
export async function DELETE(
  _req: Request,
  { params }: { params: { name: string } }
) {
  try {
    const name = decodeURIComponent(params.name).trim();
    if (!name) {
      return NextResponse.json({ error: "name は必須です" }, { status: 400 });
    }
    await prisma.unitType.deleteMany({ where: { name } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/unit-types/[name]] DELETE failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
