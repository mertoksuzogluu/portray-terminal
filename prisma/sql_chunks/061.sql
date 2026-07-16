-- CreateIndex
CREATE INDEX "alert_events_alertRuleId_triggeredAt_idx" ON "alert_events"("alertRuleId", "triggeredAt");

