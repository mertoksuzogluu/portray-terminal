import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import { lookupAsset, type AssetCategory } from "@/lib/services/asset-lookup";

const VALID: AssetCategory[] = ["FUND", "BIST", "US", "FX", "GOLD", "CRYPTO"];

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await req.json();
    const category = String(body.category ?? "") as AssetCategory;
    const code = String(body.code ?? "");

    if (!VALID.includes(category)) {
      return jsonError(new Error("Geçersiz kategori."), 400);
    }
    if (!code.trim()) {
      return jsonError(new Error("Kod/sembol girin."), 400);
    }

    const result = await lookupAsset(category, code);
    return jsonOk({ result });
  } catch (error) {
    return jsonError(error, 400);
  }
}
