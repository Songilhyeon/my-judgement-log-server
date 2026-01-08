// api/analysis/pending/route.ts
import { NextResponse } from "next/server";
import { decisionRepo } from "@/lib/repo";
import { getUserId } from "@/lib/auth";
import { corsHeaders, corsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: Request) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. (x-user-id 헤더 없음)" },
      { status: 401, headers: corsHeaders }
    );
  }

  const pending = await decisionRepo.listPending({ userId });
  return NextResponse.json(pending, { headers: corsHeaders });
}
