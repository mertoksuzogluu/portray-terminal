import { NextRequest } from "next/server";
import { loginWithPassword } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return jsonError(new Error("E-posta ve şifre gerekli."), 400);
    }

    const user = await loginWithPassword(email, password);
    return jsonOk({ user });
  } catch (error) {
    return jsonError(error, 401);
  }
}
