import crypto from "crypto";

type JwtPayload = {
  sub?: string;
  userId?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
};

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  return Buffer.from(padded, "base64");
}

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyJwt(token: string, secret: string): JwtPayload | null {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  let header: { alg?: string };
  let payload: JwtPayload;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf-8"));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8"));
  } catch {
    return null;
  }

  if (header.alg !== "HS256") return null;

  const data = `${headerB64}.${payloadB64}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest();
  const actual = base64UrlDecode(signatureB64);
  if (!timingSafeEqual(expected, actual)) return null;

  if (typeof payload.exp === "number") {
    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) return null;
  }

  return payload;
}

function base64UrlEncode(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function signJwt(payload: JwtPayload, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest();
  const signatureB64 = base64UrlEncode(signature);
  return `${data}.${signatureB64}`;
}

export function createUserToken(
  userId: string,
  ttlSeconds = 60 * 60 * 24 * 30
) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    {
      sub: userId,
      iat: now,
      exp: now + ttlSeconds,
    },
    secret
  );
}

export function getUserId(req?: Request) {
  const auth = req?.headers.get("authorization")?.trim();
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const payload = verifyJwt(token, secret);
  if (!payload) return null;

  const userId = typeof payload.sub === "string" ? payload.sub : payload.userId;
  return typeof userId === "string" && userId.trim() ? userId : null;
}
