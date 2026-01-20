import { Prisma, type Decision as PrismaDecision } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Decision, DecisionMeta } from "@/types/decision";
import type { DecisionResult } from "@/types/category";
import type {
  DecisionRepo,
  CreateDecisionInput,
  UpdateDecisionInput,
  UpdateDecisionResultInput,
} from "./decisionRepo";

function normalizeTags(tags: unknown): string[] {
  return Array.isArray(tags)
    ? tags
        .map(String)
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
}

function toDecision(row: PrismaDecision): Decision {
  const metaValue =
    row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as DecisionMeta)
      : undefined;

  return {
    id: row.id,
    userId: row.userId,
    categoryId: row.categoryId,
    title: row.title,
    notes: row.notes ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    confidence: row.confidence,
    result: row.result as DecisionResult,
    meta: metaValue,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : undefined,
  };
}

export const prismaDecisionRepo: DecisionRepo = {
  async list({ userId }) {
    const rows = await prisma.decision.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDecision);
  },

  async listPending({ userId }) {
    const rows = await prisma.decision.findMany({
      where: { userId, result: "pending" },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDecision);
  },

  async getById({ userId, id }) {
    const row = await prisma.decision.findFirst({
      where: { id, userId },
    });
    return row ? toDecision(row) : undefined;
  },

  async create(input: CreateDecisionInput) {
    const row = await prisma.decision.create({
      data: {
        userId: input.userId,
        categoryId: input.categoryId,
        title: input.title?.trim() ?? "",
        notes: input.notes?.trim() || null,
        tags: normalizeTags(input.tags),
        confidence: input.confidence,
        result: (input.result ?? "pending") as string,
        meta: input.meta ?? undefined,
      },
    });
    return toDecision(row);
  },

  async updateResult({ id, userId, result, confidence, meta }) {
    const exists = await prisma.decision.findFirst({ where: { id, userId } });
    if (!exists) return undefined;

    const nextMeta =
      meta === null
        ? Prisma.JsonNull
        : meta ?? (exists.meta === null ? Prisma.JsonNull : exists.meta);

    const row = await prisma.decision.update({
      where: { id },
      data: {
        result,
        confidence:
          typeof confidence === "number" && confidence >= 1 && confidence <= 5
            ? confidence
            : exists.confidence,
        resolvedAt: result === "pending" ? null : new Date(),
        meta: nextMeta,
      },
    });
    return toDecision(row);
  },

  async update({
    id,
    userId,
    categoryId,
    title,
    notes,
    tags,
    confidence,
    meta,
  }: UpdateDecisionInput) {
    const exists = await prisma.decision.findFirst({ where: { id, userId } });
    if (!exists) return undefined;

    const nextMeta =
      meta === null
        ? Prisma.JsonNull
        : meta ?? (exists.meta === null ? Prisma.JsonNull : exists.meta);

    const row = await prisma.decision.update({
      where: { id },
      data: {
        categoryId: typeof categoryId === "string" ? categoryId : undefined,
        title:
          typeof title === "string" && title.trim() ? title.trim() : undefined,
        notes:
          notes === null
            ? null
            : typeof notes === "string" && notes.trim()
            ? notes.trim()
            : undefined,
        tags: Array.isArray(tags) ? normalizeTags(tags) : undefined,
        confidence:
          typeof confidence === "number" && confidence >= 1 && confidence <= 5
            ? confidence
            : undefined,
        meta: nextMeta,
      },
    });
    return toDecision(row);
  },

  async remove({ userId, id }) {
    const res = await prisma.decision.deleteMany({ where: { id, userId } });
    return res.count > 0;
  },
};
