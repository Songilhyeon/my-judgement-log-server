// app/api/decisions/[id]/route.ts
import { NextResponse } from "next/server";
import type { DecisionResult } from "@/types/category";
import type { Decision } from "@/types/decision";
import { decisionRepo } from "@/lib/repo";
import { getUserId } from "@/lib/auth";
import { corsHeaders, corsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. (x-user-id 헤더 없음)" },
      { status: 401, headers: corsHeaders }
    );
  }

  const id = (await params).id;

  const d = await decisionRepo.getById({ userId, id });
  if (!d) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders }
    );
  }
  return NextResponse.json(d, { headers: corsHeaders });
}

/**
 * PATCH는 두 모드 지원
 * 1) 결과 입력: { result: "pending"|"positive"|"negative"|"neutral", confidence? }
 * 2) 상세 수정: { title?, notes?, tags?, categoryId?, confidence?, meta? }
 */
type PatchBody =
  | {
      result: DecisionResult; // pending 포함
      confidence?: number;
      meta?: Decision["meta"] | null;
    }
  | {
      categoryId?: string;
      title?: string;
      notes?: string | null;
      tags?: string[];
      confidence?: number;
      meta?: Decision["meta"] | null;
    };

function isValidResult(r: unknown): r is DecisionResult {
  return (
    r === "pending" || r === "positive" || r === "negative" || r === "neutral"
  );
}

function calcReturnRate(
  entryPrice: unknown,
  exitPrice: unknown,
  action: unknown
) {
  if (typeof entryPrice !== "number" || typeof exitPrice !== "number") {
    return undefined;
  }
  if (!Number.isFinite(entryPrice) || !Number.isFinite(exitPrice)) {
    return undefined;
  }
  if (entryPrice <= 0) return undefined;
  const isSell = action === "sell";
  const raw = isSell
    ? (entryPrice - exitPrice) / entryPrice
    : (exitPrice - entryPrice) / entryPrice;
  return Math.round(raw * 1000) / 10;
}

function mergeMeta(
  prev: Decision["meta"] | undefined,
  next: Decision["meta"] | null | undefined
) {
  if (next === null) return undefined;
  if (!next) return prev;
  return { ...(prev ?? {}), ...next };
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = getUserId(req);

  console.log(req);
  if (!userId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. (x-user-id 헤더 없음)" },
      { status: 401, headers: corsHeaders }
    );
  }

  const id = (await params).id;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }

  // ✅ 모드1: 결과 입력/수정 (pending 포함)
  if ("result" in body) {
    if (!isValidResult(body.result)) {
      return NextResponse.json(
        {
          error: "result must be one of: pending, positive, negative, neutral",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const prev = await decisionRepo.getById({ userId, id });
    if (!prev) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    let metaPayload: Decision["meta"] | null | undefined;
    if ("meta" in body) {
      if (body.meta === null) {
        metaPayload = null;
      } else if (body.meta !== undefined) {
        const merged = mergeMeta(prev.meta, body.meta);
        const rate = calcReturnRate(
          merged?.entryPrice,
          merged?.exitPrice,
          merged?.action
        );
        metaPayload =
          rate !== undefined ? { ...(merged ?? {}), returnRate: rate } : merged;
      }
    }

    const updated = await decisionRepo.updateResult({
      userId,
      id,
      result: body.result,
      confidence: body.confidence,
      meta: metaPayload,
    });

    if (!updated) {
      // userId가 다르거나 없으면 그냥 Not found
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(updated, { headers: corsHeaders });
  }

  // ✅ 모드2: 상세 수정
  const prev = await decisionRepo.getById({ userId, id });
  if (!prev) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders }
    );
  }

  let metaPayload: Decision["meta"] | null | undefined;
  if ("meta" in body) {
    if (body.meta === null) {
      metaPayload = null;
    } else if (body.meta !== undefined) {
      const merged = mergeMeta(prev.meta, body.meta);
      const rate = calcReturnRate(
        merged?.entryPrice,
        merged?.exitPrice,
        merged?.action
      );
      metaPayload =
        rate !== undefined ? { ...(merged ?? {}), returnRate: rate } : merged;
    }
  }

  const updated = await decisionRepo.update({
    userId,
    id,
    categoryId: body.categoryId,
    title: body.title,
    notes: body.notes,
    tags: body.tags,
    confidence: body.confidence,
    meta: metaPayload,
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders }
    );
  }

  return NextResponse.json(updated, { headers: corsHeaders });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. (x-user-id 헤더 없음)" },
      { status: 401, headers: corsHeaders }
    );
  }

  const id = params.id;

  const ok = await decisionRepo.remove({ userId, id });
  if (!ok) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders }
    );
  }
  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}
