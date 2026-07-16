-- CreateIndex
CREATE UNIQUE INDEX "portfolio_reports_portfolioId_reportType_periodStart_period_key" ON "portfolio_reports"("portfolioId", "reportType", "periodStart", "periodEnd");

