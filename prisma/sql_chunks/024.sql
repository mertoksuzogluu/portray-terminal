-- CreateTable
CREATE TABLE "realized_gains" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "realizedAmount" DECIMAL(24,8) NOT NULL,
    "costBasis" DECIMAL(24,8) NOT NULL,
    "proceeds" DECIMAL(24,8) NOT NULL,
    "method" "RealizedGainMethod" NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    "realizedAt" DATE NOT NULL,

    CONSTRAINT "realized_gains_pkey" PRIMARY KEY ("id")
);

