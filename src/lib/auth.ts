export function getUserId(req?: Request) {
  const userId = req?.headers.get("x-user-id")?.trim();
  return userId || null;
}
