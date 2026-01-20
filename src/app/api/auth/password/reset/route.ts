import crypto from "crypto";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, corsOptions } from "@/lib/cors";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(1).trim(),
  password: z.string().min(8).trim(),
});

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
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
      { error: "입력값이 올바르지 않습니다." },
      { status: 400, headers: corsHeaders }
    );
  }

  const tokenHash = hashToken(body.token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { userId: true, expiresAt: true },
  });

  if (!record || record.expiresAt.getTime() <= Date.now()) {
    if (record) {
      await prisma.passwordResetToken.delete({ where: { tokenHash } });
    }
    return NextResponse.json(
      { error: "토큰이 만료되었거나 유효하지 않습니다." },
      { status: 400, headers: corsHeaders }
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}
