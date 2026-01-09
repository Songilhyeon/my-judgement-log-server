// lib/repo/fileDecisionRepo.ts
import fs from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import type { Decision } from "@/types/decision";
import type { DecisionResult } from "@/types/category";
import type {
  DecisionRepo,
  CreateDecisionInput,
  UpdateDecisionResultInput,
  UpdateDecisionInput,
} from "./decisionRepo";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "decisions.json");

// 간단한 동시성 보호: write queue
let writeChain: Promise<void> = Promise.resolve();

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(
      FILE_PATH,
      JSON.stringify([] as Decision[], null, 2),
      "utf-8"
    );
  }
}

async function readAll(): Promise<Decision[]> {
  await ensureFile();
  const raw = await fs.readFile(FILE_PATH, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Decision[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(next: Decision[]) {
  await ensureFile();
  writeChain = writeChain.then(() =>
    fs.writeFile(FILE_PATH, JSON.stringify(next, null, 2), "utf-8")
  );
  await writeChain;
}

function isValidResult(r: unknown): r is DecisionResult {
  return (
    r === "pending" || r === "positive" || r === "negative" || r === "neutral"
  );
}

export const fileDecisionRepo: DecisionRepo = {
  async list({ userId }) {
    const all = await readAll();
    const mine = all.filter((d) => d.userId === userId);
    return mine.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async listPending({ userId }) {
    const all = await this.list({ userId });
    return all.filter((d) => d.result === "pending");
  },

  async getById({ userId, id }) {
    const all = await readAll();
    return all.find((d) => d.id === id && d.userId === userId);
  },

  async create(input: CreateDecisionInput) {
    const all = await readAll();

    const now = new Date().toISOString();
    const result: DecisionResult =
      input.result && isValidResult(input.result) ? input.result : "pending";

    // ✅ userId는 필수 (타입으로도 강제되지만 런타임 방어도 추가)
    const userId =
      typeof (input as CreateDecisionInput).userId === "string" &&
      (input as CreateDecisionInput).userId.trim()
        ? (input as CreateDecisionInput).userId.trim()
        : "";

    if (!userId) {
      throw new Error("userId is required");
    }

    const decision: Decision = {
      id: uuid(),
      createdAt: now,
      resolvedAt: result === "pending" ? undefined : now,
      ...input,
      userId,
      result,
      tags: Array.isArray(input.tags)
        ? input.tags
            .map(String)
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      confidence:
        typeof input.confidence === "number" &&
        input.confidence >= 1 &&
        input.confidence <= 5
          ? input.confidence
          : 3,
      title: input.title?.trim() ?? "",
      notes: input.notes?.trim() ? input.notes.trim() : undefined,
    };

    all.unshift(decision);
    await writeAll(all);
    return decision;
  },

  async updateResult({
    id,
    userId,
    result,
    confidence,
    meta,
  }: UpdateDecisionResultInput) {
    const all = await readAll();
    const idx = all.findIndex((d) => d.id === id && d.userId === userId);
    if (idx === -1) return undefined;

    const prev = all[idx];

    const next: Decision = {
      ...prev,
      result,
      confidence:
        typeof confidence === "number" && confidence >= 1 && confidence <= 5
          ? confidence
          : prev.confidence,
      resolvedAt: result === "pending" ? undefined : new Date().toISOString(),
      meta: meta === null ? undefined : meta ?? prev.meta,
    };

    all[idx] = next;
    await writeAll(all);
    return next;
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
    const all = await readAll();
    const idx = all.findIndex((d) => d.id === id && d.userId === userId);
    if (idx === -1) return undefined;

    const prev = all[idx];

    const next: Decision = {
      ...prev,
      categoryId: typeof categoryId === "string" ? categoryId : prev.categoryId,
      title:
        typeof title === "string" && title.trim() ? title.trim() : prev.title,
      notes:
        notes === null
          ? undefined
          : typeof notes === "string" && notes.trim()
          ? notes.trim()
          : prev.notes,
      tags: Array.isArray(tags)
        ? tags
            .map(String)
            .map((t) => t.trim())
            .filter(Boolean)
        : prev.tags,
      confidence:
        typeof confidence === "number" && confidence >= 1 && confidence <= 5
          ? confidence
          : prev.confidence,
      meta: meta === null ? undefined : meta ?? prev.meta,
    };

    all[idx] = next;
    await writeAll(all);
    return next;
  },

  async remove({ userId, id }) {
    const all = await readAll();
    const before = all.length;

    // ✅ 내 것만 삭제 가능
    const next = all.filter((d) => !(d.id === id && d.userId === userId));
    if (next.length === before) return false;

    await writeAll(next);
    return true;
  },
};
