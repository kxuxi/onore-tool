import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeErrorResponse } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const errorResponse = makeErrorResponse("api/unit-types/[name]");

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
    const res = await prisma.unitType.deleteMany({ where: { name } });
    // 実際に削除された件数を返し、存在しない名前の削除を呼び出し側が判別できるようにする。
    return NextResponse.json({ ok: true, deleted: res.count });
  } catch (err) {
    return errorResponse("DELETE", err);
  }
}
