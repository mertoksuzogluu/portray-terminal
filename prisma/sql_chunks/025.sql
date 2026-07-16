-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "assetId" TEXT,
    "name" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "comparisonOperator" "ComparisonOperator" NOT NULL,
    "threshold" DECIMAL(24,8) NOT NULL,
    "lookbackDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

