import { NextResponse } from "next/server";
import type { Decision } from "@/types/decision";
import type { WeeklySuccessTrendResponse } from "@/types/analysis";
import { decisionRepo } from "@/lib/repo";
import { getUserId } from "@/lib/auth";
import { corsHeaders, corsOptions } from "@/lib/cors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function OPTIONS() {
  return corsOptions();
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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

function parseWeeks(raw: string | null) {
  if (!raw) return 8;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 8;
  return clampInt(parsed, 4, 24);
}

function toDate(iso?: string | null) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t);
}

export async function GET(req: Request) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. (token 없음)" },
      { status: 401, headers: corsHeaders }
    );
  }

  const url = new URL(req.url);
  const weeksCount = parseWeeks(url.searchParams.get("weeks"));
  const categoryId = url.searchParams.get("categoryId");

  const list = await decisionRepo.list({ userId });

  const now = new Date();
  const currentWeekStart = startOfWeekUtc(now);
  const firstWeekStart = addDaysUtc(currentWeekStart, -7 * (weeksCount - 1));
  const endExclusive = addDaysUtc(currentWeekStart, 7);

  const buckets = new Map<string, { total: number; positive: number }>();
  const weeks: WeeklySuccessTrendResponse["weeks"] = [];

  for (let i = 0; i < weeksCount; i += 1) {
    const start = addDaysUtc(firstWeekStart, i * 7);
    const key = toIsoDateUtc(start);
    buckets.set(key, { total: 0, positive: 0 });
    weeks.push({
      weekStart: key,
      weekEnd: toIsoDateUtc(addDaysUtc(start, 6)),
      total: 0,
      positiveRate: 0,
    });
  }

  for (const d of list as Decision[]) {
    if (d.result === "pending") continue;
    if (categoryId && categoryId !== "all" && d.categoryId !== categoryId) {
      continue;
    }

    const date = toDate(d.resolvedAt ?? d.createdAt ?? null);
    if (!date) continue;
    if (date < firstWeekStart || date >= endExclusive) continue;

    const weekStart = startOfWeekUtc(date);
    const key = toIsoDateUtc(weekStart);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (d.result === "positive") bucket.positive += 1;
  }

  const resultWeeks = weeks.map((w) => {
    const bucket = buckets.get(w.weekStart);
    if (!bucket || bucket.total === 0) return w;
    const positiveRate = Math.round((bucket.positive / bucket.total) * 1000) / 10;
    return {
      ...w,
      total: bucket.total,
      positiveRate,
    };
  });

  return NextResponse.json<WeeklySuccessTrendResponse>(
    { weeks: resultWeeks },
    { headers: corsHeaders }
  );
}
