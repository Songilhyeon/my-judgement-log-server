import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, corsOptions } from "@/lib/cors";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email().trim(),
});

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function resolveTtlMinutes() {
  const raw = process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? "30";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function buildResetUrl(token: string) {
  const baseUrl = process.env.PASSWORD_RESET_URL_BASE?.trim();
  if (!baseUrl) return null;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(req: Request) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "이메일 입력이 올바르지 않습니다." },
      { status: 400, headers: corsHeaders }
    );
  }

  const normalizedEmail = body.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const ttlMinutes = resolveTtlMinutes();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const response: Record<string, unknown> = { ok: true };
  if (process.env.NODE_ENV !== "production") {
    response.resetToken = token;
    const resetUrl = buildResetUrl(token);
    if (resetUrl) response.resetUrl = resetUrl;
  }

  return NextResponse.json(response, { headers: corsHeaders });
}
