-- CreateTable
CREATE TABLE "portfolio_reports" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_reports_pkey" PRIMARY KEY ("id")
);

