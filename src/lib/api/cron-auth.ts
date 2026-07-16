import { NextRequest } from "next/server";

export function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  return authorization === `Bearer ${secret}` || cronHeader === secret;
}
