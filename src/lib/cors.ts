// lib/cors.ts
// ✅ 1) CORS 전용
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-user-id",
};

// ✅ 2) Cache 방지 전용 (이 라우트만 필요하면 여기서만 추가)
export const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export function corsOptions() {
  return new Response(null, { headers: corsHeaders });
}

export function corsOptionsNoCache() {
  return new Response(null, { headers: { ...corsHeaders, ...noCacheHeaders } });
}
