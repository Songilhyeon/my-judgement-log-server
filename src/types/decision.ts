// types/decision.ts
import type { DecisionResult } from "./category";

export type DecisionMeta = Record<string, string | number | boolean | null>;

export type Decision = {
  id: string;
  userId: string;
  categoryId: string; // Category.id
  title: string; // 한 줄 요약
  notes?: string; // 근거/상황
  tags: string[];
  confidence: number; // 1~5
  result: DecisionResult;
  meta?: DecisionMeta; // 투자/쇼핑 등 추가 필드 저장용
  createdAt: string; // ISO
  resolvedAt?: string; // ISO
};
