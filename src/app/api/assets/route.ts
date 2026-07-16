import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import { lookupAsset, type AssetCategory } from "@/lib/services/asset-lookup";

const VALID: AssetCategory[] = ["FUND", "BIST", "US", "FX", "GOLD", "CRYPTO"];

export async function GET() {
  try {
    await requireUser();
    const assets = await prisma.asset.findMany({
      where: { isActive: true },
      orderBy: [{ assetType: "asc" }, { symbol: "asc" }],
      select: {
        id: true,
        symbol: true,
        name: true,
        assetType: true,
        exchange: true,
        currency: true,
      },
    });
    return jsonOk({ assets });
  } catch (error) {
    return jsonError(error);
  }
}

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

    // Sunucu tarafında yeniden doğrula (client'a güvenme)
    const meta = await lookupAsset(category, code);

    const existing = await prisma.asset.findUnique({
      where: { symbol_assetType: { symbol: meta.symbol, assetType: meta.assetType } },
    });

    const asset = existing
      ? await prisma.asset.update({
          where: { id: existing.id },
          data: {
            name: meta.name,
            exchange: meta.exchange,
            currency: meta.currency,
            provider: meta.provider,
            providerSymbol: meta.providerSymbol,
            tefasCode: meta.tefasCode,
            isin: meta.isin ?? existing.isin,
            isActive: true,
          },
        })
      : await prisma.asset.create({
          data: {
            symbol: meta.symbol,
            name: meta.name,
            assetType: meta.assetType,
            exchange: meta.exchange,
            currency: meta.currency,
            provider: meta.provider,
            providerSymbol: meta.providerSymbol,
            tefasCode: meta.tefasCode,
            isin: meta.isin,
          },
        });

    // Güncel fiyatı kaydet (varsa)
    if (meta.price) {
      const priceDate = meta.priceDate ? new Date(meta.priceDate) : new Date();
      priceDate.setHours(0, 0, 0, 0);
      await prisma.assetPrice.upsert({
        where: {
          assetId_priceDate_source: {
            assetId: asset.id,
            priceDate,
            source: meta.provider,
          },
        },
        create: {
          assetId: asset.id,
          priceDate,
          close: meta.price,
          previousClose: meta.previousClose,
          currency: meta.currency,
          source: meta.provider,
          dataQuality: meta.dataQuality as never,
          isDelayed: meta.dataQuality !== "LIVE",
        },
        update: {
          close: meta.price,
          previousClose: meta.previousClose,
          fetchedAt: new Date(),
        },
      });
    }

    return jsonOk({
      asset: {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.assetType,
        exchange: asset.exchange,
        currency: asset.currency,
      },
      created: !existing,
      price: meta.price,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}
