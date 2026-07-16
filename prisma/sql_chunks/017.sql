-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT,
    "transactionType" "TransactionType" NOT NULL,
    "transactionDate" DATE NOT NULL,
    "settlementDate" DATE,
    "quantity" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "commission" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "tax" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "fxRateToBase" DECIMAL(24,8) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "importHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

