// lib/repo/index.ts
import { prismaDecisionRepo } from "./prismaDecisionRepo";
export const decisionRepo = prismaDecisionRepo;

// import { fileDecisionRepo } from "./fileDecisionRepo";
// export const decisionRepo = fileDecisionRepo; // ✅ 나중에 DB로 바꾸면 여기만 교체
