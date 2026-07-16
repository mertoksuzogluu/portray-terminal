import { NextRequest } from "next/server";
import { registerUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";

/**
 * Davet kodlu kayıt. Sadece INVITE_CODE ortam değişkenindeki kodu bilenler
 * hesap açabilir. Kod tanımlı değilse kayıt tamamen kapalıdır.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = body.name ? String(body.name).trim() : undefined;
    const inviteCode = String(body.inviteCode ?? "").trim();

    const expected = process.env.INVITE_CODE?.trim();
    if (!expected) {
      return jsonError(new Error("Kayıt şu anda kapalı."), 403);
    }
    if (inviteCode !== expected) {
      return jsonError(new Error("Davet kodu geçersiz."), 403);
    }
    if (!email || !email.includes("@")) {
      return jsonError(new Error("Geçerli bir e-posta girin."), 400);
    }
    if (password.length < 8) {
      return jsonError(new Error("Şifre en az 8 karakter olmalı."), 400);
    }

    const user = await registerUser({ email, password, name });
    return jsonOk({ user });
  } catch (error) {
    return jsonError(error, 400);
  }
}
