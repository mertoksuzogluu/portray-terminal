-- CreateTable
CREATE TABLE "asset_prices" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "priceDate" DATE NOT NULL,
    "open" DECIMAL(24,8),
    "high" DECIMAL(24,8),
    "low" DECIMAL(24,8),
    "close" DECIMAL(24,8) NOT NULL,
    "previousClose" DECIMAL(24,8),
    "volume" DECIMAL(24,4),
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "source" TEXT NOT NULL,
    "dataQuality" "DataQuality" NOT NULL DEFAULT 'DELAYED',
    "isDelayed" BOOLEAN NOT NULL DEFAULT true,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_prices_pkey" PRIMARY KEY ("id")
);

