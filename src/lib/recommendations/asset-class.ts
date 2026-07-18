import type { AssetType } from "@prisma/client";
import type { AssetClassId } from "./types";

export function assetTypeToClass(assetType: AssetType | string): AssetClassId {
  switch (assetType) {
    case "STOCK":
    case "ETF":
    case "CRYPTO":
      return "EQUITY";
    case "MUTUAL_FUND":
      return "FUND";
    case "FX":
      return "FX";
    case "GOLD":
      return "GOLD";
    case "CASH":
      return "CASH";
    default:
      return "EQUITY";
  }
}
