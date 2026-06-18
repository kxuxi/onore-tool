import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeErrorResponse } from "@/lib/apiError";
import { requireAdmin } from "@/lib/authGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const errorResponse = makeErrorResponse("api/battle-records/[id]");

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = requireAdmin();
  if (denied) return denied;

  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "無効な戦闘記録IDです" },
        { status: 400 }
      );
    }

    const result = await prisma.battleRecord.delete({
      where: { id },
    });

    return NextResponse.json({
      ok: true,
      deleted: {
        id: result.id,
        line: result.line,
      },
    });
  } catch (err) {
    return errorResponse("DELETE", err);
  }
}
