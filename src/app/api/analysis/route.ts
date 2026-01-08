// api/analysis/route.ts
import { NextResponse } from "next/server";
import type { Decision } from "@/types/decision";
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

  // ✅ 내 데이터만
  const list = await decisionRepo.list({ userId });

  const total = list.length;
  const completed = list.filter((d) => d.result !== "pending");
  const pending = total - completed.length;

  const positive = completed.filter((d) => d.result === "positive").length;
  const negative = completed.filter((d) => d.result === "negative").length;
  const neutral = completed.filter((d) => d.result === "neutral").length;

  const positiveRate =
    completed.length === 0
      ? 0
      : Math.round((positive / completed.length) * 100);

  // 투자(invest) + meta.action(buy/sell)만 action 분석
  const investCompleted = completed.filter((d) => d.categoryId === "invest");

  const byAction = {
    buy: calcInvestAction(investCompleted, "buy"),
    sell: calcInvestAction(investCompleted, "sell"),
  };

  // 확신도별
  const confidenceStats = [1, 2, 3, 4, 5].map((c) => {
    const bucket = completed.filter((d) => d.confidence === c);
    const pos = bucket.filter((d) => d.result === "positive").length;

    return {
      confidence: c,
      total: bucket.length,
      positiveRate:
        bucket.length === 0 ? 0 : Math.round((pos / bucket.length) * 100),
    };
  });

  // 카테고리별
  const byCategory = groupByCategory(completed);

  return NextResponse.json(
    {
      total,
      completed: completed.length,
      pending,
      resultCounts: { positive, negative, neutral },
      positiveRate,
      byAction,
      confidenceStats,
      byCategory,
    },
    { headers: corsHeaders }
  );
}

/* ---------------- helper ---------------- */

function calcInvestAction(investCompleted: Decision[], action: "buy" | "sell") {
  const list = investCompleted.filter((d) => d.meta?.action === action);
  const pos = list.filter((d) => d.result === "positive").length;

  return {
    total: list.length,
    positiveRate: list.length === 0 ? 0 : Math.round((pos / list.length) * 100),
  };
}

function groupByCategory(completed: Decision[]) {
  const map = new Map<
    string,
    { total: number; positive: number; negative: number; neutral: number }
  >();

  for (const d of completed) {
    const key = d.categoryId ?? "unknown";
    if (!map.has(key))
      map.set(key, { total: 0, positive: 0, negative: 0, neutral: 0 });
    const row = map.get(key)!;

    row.total += 1;
    if (d.result === "positive") row.positive += 1;
    else if (d.result === "negative") row.negative += 1;
    else if (d.result === "neutral") row.neutral += 1;
  }

  return Array.from(map.entries()).map(([categoryId, v]) => ({
    categoryId,
    total: v.total,
    positiveRate: v.total === 0 ? 0 : Math.round((v.positive / v.total) * 100),
    resultCounts: {
      positive: v.positive,
      negative: v.negative,
      neutral: v.neutral,
    },
  }));
}
