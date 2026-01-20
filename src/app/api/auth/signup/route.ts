import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { corsHeaders, corsOptions } from "@/lib/cors";
import { createUserToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().trim(),
  password: z.string().min(8).trim(),
});

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(req: Request) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "이메일/비밀번호 입력이 올바르지 않습니다." },
      { status: 400, headers: corsHeaders }
    );
  }

  const normalizedEmail = body.email.toLowerCase();

  const exists = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (exists) {
    return NextResponse.json(
      { error: "이미 가입된 이메일입니다." },
      { status: 409, headers: corsHeaders }
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
    },
    select: { id: true, email: true },
  });

  const token = createUserToken(user.id);
  if (!token) {
    return NextResponse.json(
      { error: "JWT_SECRET is not configured" },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json({ token, user }, { headers: corsHeaders });
}
