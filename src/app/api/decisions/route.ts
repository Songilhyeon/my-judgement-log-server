// app/api/decisions/route.ts
import { NextResponse } from "next/server";
import type { Decision } from "@/types/decision";
import type { DecisionResult } from "@/types/category";
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

  // ✅ 전체를 가져오더라도 서버에서 내 것만 필터링
  const list = await decisionRepo.list({ userId });
  return NextResponse.json(list, { headers: corsHeaders });
}

type CreateDecisionBody = {
  categoryId: string;
  title: string;
  notes?: string;
  tags?: string[];
  confidence?: number;
  result?: DecisionResult;
  meta?: Decision["meta"];
};

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. (x-user-id 헤더 없음)" },
      { status: 401, headers: corsHeaders }
    );
  }

  let body: CreateDecisionBody;
  try {
    body = (await req.json()) as CreateDecisionBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!body.categoryId || typeof body.categoryId !== "string") {
    return NextResponse.json(
      { error: "categoryId is required" },
      { status: 400, headers: corsHeaders }
    );
  }
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400, headers: corsHeaders }
    );
  }

  // ✅ create 시 userId를 서버에서 강제로 넣는다 (클라가 임의로 바꾸지 못하게)
  const created = await decisionRepo.create({
    userId,
    categoryId: body.categoryId,
    title: body.title,
    notes: body.notes,
    tags: body.tags ?? [],
    confidence: body.confidence ?? 3,
    result: body.result ?? "pending",
    meta: body.meta,
  });

  return NextResponse.json(created, { headers: corsHeaders });
}
