// app/api/analysis/summary/route.ts
import { NextResponse } from "next/server";
import type { AnalysisSummaryResponse } from "@/types/analysis";
import type { Decision } from "@/types/decision";
import { decisionRepo } from "@/lib/repo";
import { DecisionMeta } from "@/types/decision";
import { getUserId } from "@/lib/auth";
import { corsHeaders, noCacheHeaders, corsOptionsNoCache } from "@/lib/cors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ✅ 이 라우트는 캐시 막아야 하니까 합쳐서 사용
const headers = { ...corsHeaders, ...noCacheHeaders };

export async function OPTIONS() {
  return corsOptionsNoCache();
}

type ResolvedResult = Exclude<Decision["result"], "pending">;

function safeInt(v: unknown, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function percent(numer: number, denom: number) {
  if (denom <= 0) return 0;
  return Math.round((numer / denom) * 100);
}
function avg(nums: number[]) {
  if (nums.length === 0) return 0;
  const s = nums.reduce((a, b) => a + b, 0);
  return round1(s / nums.length);
}
function isoToMs(iso?: string | null) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}
function getResolvedMs(d: Decision) {
  return isoToMs(d.resolvedAt ?? d.createdAt ?? null);
}
function isCompleted(d: Decision) {
  return d.result !== "pending";
}
function isResolvedResult(r: Decision["result"]): r is ResolvedResult {
  return r === "positive" || r === "negative" || r === "neutral";
}

// 투자(invest) + meta.action(buy/sell)만 action 분석
function calcInvestAction(investCompleted: Decision[], action: "buy" | "sell") {
  const list = investCompleted.filter((d) => d.meta?.action === action);
  const pos = list.filter((d) => d.result === "positive").length;
  const confs = list.map((d) => safeInt(d.confidence)).filter((n) => n > 0);

  return {
    total: list.length,
    positiveRate: list.length === 0 ? 0 : percent(pos, list.length),
    avgConfidenceCompleted: avg(confs),
  };
}

function groupByCategory(completed: Decision[]) {
  const map = new Map<
    string,
    {
      total: number;
      positive: number;
      negative: number;
      neutral: number;
      confs: number[];
    }
  >();

  for (const d of completed) {
    const key = d.categoryId ?? "unknown";
    if (!map.has(key)) {
      map.set(key, {
        total: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        confs: [],
      });
    }
    const row = map.get(key)!;

    row.total += 1;
    if (d.result === "positive") row.positive += 1;
    else if (d.result === "negative") row.negative += 1;
    else if (d.result === "neutral") row.neutral += 1;

    const c = safeInt(d.confidence);
    if (c > 0) row.confs.push(c);
  }

  return Array.from(map.entries())
    .map(([categoryId, v]) => ({
      categoryId,
      total: v.total,
      positiveRate: v.total === 0 ? 0 : percent(v.positive, v.total),
      resultCounts: {
        positive: v.positive,
        negative: v.negative,
        neutral: v.neutral,
      },
      avgConfidenceCompleted: avg(v.confs),
    }))
    .sort((a, b) => b.total - a.total);
}

function buildTopTags(list: Decision[], completed: Decision[]) {
  const countMap = new Map<string, number>();
  for (const d of list) {
    const tags = Array.isArray(d.tags) ? d.tags : [];
    for (const raw of tags) {
      const tag = String(raw ?? "").trim();
      if (!tag) continue;
      countMap.set(tag, (countMap.get(tag) ?? 0) + 1);
    }
  }

  const completedMap = new Map<
    string,
    { completed: number; positive: number }
  >();
  for (const d of completed) {
    const tags = Array.isArray(d.tags) ? d.tags : [];
    for (const raw of tags) {
      const tag = String(raw ?? "").trim();
      if (!tag) continue;
      const entry = completedMap.get(tag) ?? { completed: 0, positive: 0 };
      entry.completed += 1;
      if (d.result === "positive") entry.positive += 1;
      completedMap.set(tag, entry);
    }
  }

  return Array.from(countMap.entries())
    .map(([tag, count]) => {
      const stats = completedMap.get(tag) ?? { completed: 0, positive: 0 };
      return {
        tag,
        count,
        completed: stats.completed,
        positiveRate:
          stats.completed === 0 ? 0 : percent(stats.positive, stats.completed),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function buildByWeekday(completed: Decision[]) {
  const map = new Map<number, { total: number; positive: number }>();
  for (let i = 0; i < 7; i += 1) {
    map.set(i, { total: 0, positive: 0 });
  }

  for (const d of completed) {
    const ms = getResolvedMs(d);
    if (!ms) continue;
    const date = new Date(ms);
    const weekday = date.getUTCDay();
    const entry = map.get(weekday);
    if (!entry) continue;
    entry.total += 1;
    if (d.result === "positive") entry.positive += 1;
  }

  return [...map.entries()].map(([weekday, row]) => ({
    weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    total: row.total,
    positiveRate: row.total === 0 ? 0 : percent(row.positive, row.total),
  }));
}

function buildByHour(completed: Decision[]) {
  const map = new Map<number, { total: number; positive: number }>();
  for (let i = 0; i < 24; i += 1) {
    map.set(i, { total: 0, positive: 0 });
  }

  for (const d of completed) {
    const ms = getResolvedMs(d);
    if (!ms) continue;
    const date = new Date(ms);
    const hour = date.getUTCHours();
    const entry = map.get(hour);
    if (!entry) continue;
    entry.total += 1;
    if (d.result === "positive") entry.positive += 1;
  }

  return [...map.entries()].map(([hour, row]) => ({
    hour,
    total: row.total,
    positiveRate: row.total === 0 ? 0 : percent(row.positive, row.total),
  }));
}

export async function GET(req: Request) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. (token 없음)" },
      { status: 401, headers }
    );
  }

  const url = new URL(req.url);

  // query: ?days=90&categoryId=invest
  const days = Math.max(
    1,
    Math.min(3650, Number(url.searchParams.get("days") ?? "90"))
  );
  const categoryId = url.searchParams.get("categoryId") ?? undefined;

  const limit = Math.max(
    5,
    Math.min(50, Number(url.searchParams.get("limit") ?? "10"))
  );

  // ✅ 내 데이터만
  const list = await decisionRepo.list({ userId });

  // 기간 필터(createdAt: ISO)
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const filtered = list.filter((d) => {
    if (categoryId && d.categoryId !== categoryId) return false;
    const createdMs = isoToMs(d.createdAt);
    return createdMs >= sinceMs;
  });

  const total = filtered.length;

  const completed = filtered.filter(isCompleted);
  const pending = total - completed.length;

  const positive = completed.filter((d) => d.result === "positive").length;
  const negative = completed.filter((d) => d.result === "negative").length;
  const neutral = completed.filter((d) => d.result === "neutral").length;

  const positiveRate =
    completed.length === 0 ? 0 : percent(positive, completed.length);

  const avgConfidenceCompleted = avg(
    completed.map((d) => safeInt(d.confidence)).filter((n) => n > 0)
  );

  const investCompleted = completed.filter((d) => d.categoryId === "invest");
  const byAction: AnalysisSummaryResponse["byAction"] = {
    buy: calcInvestAction(investCompleted, "buy"),
    sell: calcInvestAction(investCompleted, "sell"),
  };

  const confidenceStats: AnalysisSummaryResponse["confidenceStats"] = (
    [1, 2, 3, 4, 5] as const
  ).map((c) => {
    const bucket = completed.filter((d) => d.confidence === c);
    const pos = bucket.filter((d) => d.result === "positive").length;

    return {
      confidence: c,
      total: bucket.length,
      positiveRate: bucket.length === 0 ? 0 : percent(pos, bucket.length),
    };
  });

  const byCategory: AnalysisSummaryResponse["byCategory"] =
    groupByCategory(completed);

  const topTags: AnalysisSummaryResponse["topTags"] = buildTopTags(
    filtered,
    completed
  );
  const byWeekday: AnalysisSummaryResponse["byWeekday"] =
    buildByWeekday(completed);
  const byHour: AnalysisSummaryResponse["byHour"] = buildByHour(completed);

  const recentCompleted: AnalysisSummaryResponse["recentCompleted"] = completed
    .filter((d) => isResolvedResult(d.result))
    .slice()
    .sort((a, b) => isoToMs(b.resolvedAt) - isoToMs(a.resolvedAt))
    .slice(0, 10)
    .slice(0, limit)
    .map((d) => ({
      id: d.id,
      categoryId: d.categoryId,
      title: d.title,
      result: d.result as ResolvedResult,
      confidence: safeInt(d.confidence),
      resolvedAt: d.resolvedAt ?? "",
      tags: Array.isArray(d.tags) ? d.tags : [],
      hasReflection:
        typeof (d.meta as DecisionMeta)?.reflection === "string" &&
        String((d.meta as DecisionMeta).reflection).trim().length > 0,
    }));

  const body: AnalysisSummaryResponse = {
    summary: {
      total,
      completed: completed.length,
      pending,
      resultCounts: { positive, negative, neutral },
      positiveRate,
      avgConfidenceCompleted,
    },
    byCategory,
    byAction,
    confidenceStats,
    topTags,
    byWeekday,
    byHour,
    recentCompleted,
  };

  return NextResponse.json(body, { headers });
}
