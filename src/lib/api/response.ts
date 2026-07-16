import { NextResponse } from "next/server";
import { AuthError, ForbiddenError } from "@/lib/auth/session";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown, fallbackStatus = 500) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: fallbackStatus });
  }
  return NextResponse.json({ error: "Beklenmeyen hata." }, { status: fallbackStatus });
}
