import { NextResponse } from "next/server";
import type { Decision } from "@/types/decision";
import type {
  WeeklyReportDelta,
  WeeklyReportResponse,
  WeeklyReportSummary,
} from "@/types/weekly-report";
import { decisionRepo } from "@/lib/repo";
import { getUserId } from "@/lib/auth";
import { corsHeaders, noCacheHeaders, corsOptionsNoCache } from "@/lib/cors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const headers = { ...corsHeaders, ...noCacheHeaders };

export async function OPTIONS() {
  return corsOptionsNoCache();
}

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
function rate(numer: number, denom: number) {
  if (denom <= 0) return 0;
  return round1((numer / denom) * 100);
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
function toIsoDateUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}
function addDaysUtc(date: Date, days: number) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function startOfWeekUtc(date: Date) {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  const base = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  base.setUTCDate(base.getUTCDate() - diff);
  return base;
}
function parseWeekStart(raw: string | null) {
  if (!raw) return startOfWeekUtc(new Date());
  const match = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  if (!match) return startOfWeekUtc(new Date());
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return startOfWeekUtc(new Date());
  return parsed;
}

function buildTopCategory(list: Decision[]) {
  const map = new Map<string, number>();
  for (const d of list) {
    const key = d.categoryId ?? "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  let top: { categoryId: string; total: number } | null = null;
  for (const [categoryId, total] of map.entries()) {
    if (!top || total > top.total) {
      top = { categoryId, total };
    }
  }
  return top;
}

function buildInsight(
  completed: Decision[],
  confidenceStats: WeeklyReportSummary["confidence"]["byLevel"]
) {
  if (completed.length === 0) return null;
  const positive = completed.filter((d) => d.result === "positive").length;
  if (positive === 0) return "이번 주는 긍정 결과가 없었어요.";

  const best = confidenceStats
    .filter((c) => c.total > 0)
    .sort((a, b) => b.positiveRate - a.positiveRate)[0];

  if (!best) return null;
  return `확신도 ${best.confidence}에서 성과가 가장 좋았어요.`;
}

function buildWeeklySummary(
  list: Decision[],
  weekStart: Date,
  weekEnd: Date
): WeeklyReportSummary {
  const total = list.length;
  const completed = list.filter((d) => d.result !== "pending");
  const pending = total - completed.length;

  const positive = completed.filter((d) => d.result === "positive").length;
  const negative = completed.filter((d) => d.result === "negative").length;
  const neutral = completed.filter((d) => d.result === "neutral").length;

  const confidenceStats: WeeklyReportSummary["confidence"]["byLevel"] = (
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

  const avgConfidenceCompleted = avg(
    completed.map((d) => safeInt(d.confidence)).filter((n) => n > 0)
  );

  return {
    period: {
      start: toIsoDateUtc(weekStart),
      end: toIsoDateUtc(weekEnd),
    },
    counts: {
      total,
      completed: completed.length,
      pending,
    },
    resultCounts: {
      positive,
      negative,
      neutral,
      pending,
    },
    confidence: {
      average: avgConfidenceCompleted,
      byLevel: confidenceStats,
    },
    topCategory: buildTopCategory(list),
    insight: buildInsight(completed, confidenceStats),
  };
}

function buildDelta(
  current: WeeklyReportSummary,
  previous: WeeklyReportSummary
): WeeklyReportDelta {
  const countDelta = {
    total: current.counts.total - previous.counts.total,
    completed: current.counts.completed - previous.counts.completed,
    pending: current.counts.pending - previous.counts.pending,
  };
  const resultDelta = {
    positive: current.resultCounts.positive - previous.resultCounts.positive,
    negative: current.resultCounts.negative - previous.resultCounts.negative,
    neutral: current.resultCounts.neutral - previous.resultCounts.neutral,
    pending: current.resultCounts.pending - previous.resultCounts.pending,
  };
  const resultRateDelta = {
    positive:
      rate(current.resultCounts.positive, current.counts.total) -
      rate(previous.resultCounts.positive, previous.counts.total),
    negative:
      rate(current.resultCounts.negative, current.counts.total) -
      rate(previous.resultCounts.negative, previous.counts.total),
    neutral:
      rate(current.resultCounts.neutral, current.counts.total) -
      rate(previous.resultCounts.neutral, previous.counts.total),
    pending:
      rate(current.resultCounts.pending, current.counts.total) -
      rate(previous.resultCounts.pending, previous.counts.total),
  };
  const levels = [1, 2, 3, 4, 5] as const;
  const confidenceLevelDelta = levels.map((level) => {
    const cur = current.confidence.byLevel.find((r) => r.confidence === level);
    const prev = previous.confidence.byLevel.find(
      (r) => r.confidence === level
    );
    return {
      confidence: level,
      total: safeInt(cur?.total) - safeInt(prev?.total),
      positiveRate: safeInt(cur?.positiveRate) - safeInt(prev?.positiveRate),
    };
  });

  return {
    counts: countDelta,
    resultCounts: resultDelta,
    resultRates: resultRateDelta,
    confidence: {
      average: round1(current.confidence.average - previous.confidence.average),
      byLevel: confidenceLevelDelta,
    },
  };
}

export async function GET(req: Request) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. (x-user-id 헤더 없음)" },
      { status: 401, headers }
    );
  }

  const url = new URL(req.url);
  const weekStart = parseWeekStart(url.searchParams.get("weekStart"));
  const weekEnd = addDaysUtc(weekStart, 6);
  const endExclusive = addDaysUtc(weekStart, 7).getTime();
  const startMs = weekStart.getTime();
  const prevWeekStart = addDaysUtc(weekStart, -7);
  const prevWeekEnd = addDaysUtc(prevWeekStart, 6);
  const prevEndExclusive = addDaysUtc(prevWeekStart, 7).getTime();
  const prevStartMs = prevWeekStart.getTime();

  const list = await decisionRepo.list({ userId });
  const currentFiltered = list.filter((d) => {
    const createdMs = isoToMs(d.createdAt);
    return createdMs >= startMs && createdMs < endExclusive;
  });
  const previousFiltered = list.filter((d) => {
    const createdMs = isoToMs(d.createdAt);
    return createdMs >= prevStartMs && createdMs < prevEndExclusive;
  });

  const currentSummary = buildWeeklySummary(
    currentFiltered,
    weekStart,
    weekEnd
  );
  const previousSummary = buildWeeklySummary(
    previousFiltered,
    prevWeekStart,
    prevWeekEnd
  );
  const delta = buildDelta(currentSummary, previousSummary);

  const body: WeeklyReportResponse = {
    ...currentSummary,
    previous: previousSummary,
    delta,
  };

  return NextResponse.json(body, { headers });
}
