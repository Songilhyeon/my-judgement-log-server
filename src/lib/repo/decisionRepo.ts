// lib/repo/decisionRepo.ts
import type { Decision } from "@/types/decision";
import type { DecisionResult } from "@/types/category";

// ✅ create 시 userId는 필수로 들어와야 함
export type CreateDecisionInput = Omit<
  Decision,
  "id" | "createdAt" | "resolvedAt"
>;

export type UpdateDecisionResultInput = {
  id: string;
  userId: string; // ✅ 추가
  result: DecisionResult; // pending 포함
  confidence?: number;
  meta?: Decision["meta"] | null;
};

// ✅ 상세 수정용(결과는 여기서 안 바꾸는 걸 권장)
export type UpdateDecisionInput = {
  id: string;
  userId: string; // ✅ 추가
  categoryId?: string;
  title?: string;
  notes?: string | null; // null이면 삭제
  tags?: string[];
  confidence?: number;
  meta?: Decision["meta"] | null; // null이면 삭제
};

export interface DecisionRepo {
  // ✅ 항상 userId 기반으로만 읽는다
  list(params: { userId: string }): Promise<Decision[]>;
  listPending(params: { userId: string }): Promise<Decision[]>;
  getById(params: {
    userId: string;
    id: string;
  }): Promise<Decision | undefined>;

  create(input: CreateDecisionInput): Promise<Decision>;

  updateResult(input: UpdateDecisionResultInput): Promise<Decision | undefined>;

  update(input: UpdateDecisionInput): Promise<Decision | undefined>;

  remove(params: { userId: string; id: string }): Promise<boolean>;
}
