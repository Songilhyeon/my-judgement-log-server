// types/analysis.ts
import type { Decision } from "./decision";

type ResolvedResult = Exclude<Decision["result"], "pending">;

export type AnalysisSummaryResponse = {
  summary: {
    total: number;
    completed: number;
    pending: number;
    resultCounts: { positive: number; negative: number; neutral: number };
    positiveRate: number;
    avgConfidenceCompleted: number;
  };

  byCategory: {
    categoryId: string;
    total: number;
    positiveRate: number;
    resultCounts: { positive: number; negative: number; neutral: number };
    avgConfidenceCompleted: number;
  }[];

  byAction: {
    buy: {
      total: number;
      positiveRate: number;
      avgConfidenceCompleted: number;
    };
    sell: {
      total: number;
      positiveRate: number;
      avgConfidenceCompleted: number;
    };
  };

  confidenceStats: {
    confidence: 1 | 2 | 3 | 4 | 5;
    total: number;
    positiveRate: number;
  }[];

  topTags: {
    tag: string;
    count: number;
    completed: number;
    positiveRate: number;
  }[];

  byWeekday: {
    weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    total: number;
    positiveRate: number;
  }[];

  byHour: {
    hour: number;
    total: number;
    positiveRate: number;
  }[];

  recentCompleted: {
    id: string;
    categoryId: string;
    title: string;
    result: ResolvedResult;
    confidence: number;
    resolvedAt: string;
    tags: string[];
    hasReflection: boolean;
  }[];
};

export type WeeklySuccessTrendResponse = {
  weeks: {
    weekStart: string;
    weekEnd: string;
    total: number;
    positiveRate: number;
  }[];
};
