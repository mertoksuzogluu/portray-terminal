-- CreateTable
CREATE TABLE "analysis_insights" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "insightDate" DATE NOT NULL,
    "periodType" "InsightPeriodType" NOT NULL DEFAULT 'DAILY',
    "category" "InsightCategory" NOT NULL,
    "severity" "InsightSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_insights_pkey" PRIMARY KEY ("id")
);

