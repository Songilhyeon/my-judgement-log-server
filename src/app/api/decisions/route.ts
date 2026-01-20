// app/api/decisions/route.ts
import { NextResponse } from "next/server";
import type { Decision } from "@/types/decision";
import type { DecisionResult } from "@/types/category";
import { decisionRepo } from "@/lib/repo";
import { getUserId } from "@/lib/auth";
import { corsHeaders, corsOptions } from "@/lib/cors";
import { z } from "zod";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(req: Request) {
  const userId = getUserId(req);

  if (!userId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. (token 없음)" },
      { status: 401, headers: corsHeaders },
    );
  }

  // ✅ 전체를 가져오더라도 서버에서 내 것만 필터링
  const list = await decisionRepo.list({ userId });
  return NextResponse.json(list, { headers: corsHeaders });
}

const createSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(1),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  confidence: z.number().int().min(1).max(5).optional(),
  result: z.enum(["pending", "positive", "negative", "neutral"]).optional(),
  meta: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. (token 없음)" },
      { status: 401, headers: corsHeaders },
    );
  }

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "입력값이 올바르지 않습니다." },
      { status: 400, headers: corsHeaders },
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
