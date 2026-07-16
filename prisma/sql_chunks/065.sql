-- CreateIndex
CREATE UNIQUE INDEX "analysis_insights_portfolioId_fingerprint_insightDate_key" ON "analysis_insights"("portfolioId", "fingerprint", "insightDate");

