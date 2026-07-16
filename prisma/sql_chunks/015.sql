-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "accountType" "AccountType" NOT NULL DEFAULT 'BROKERAGE',
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

