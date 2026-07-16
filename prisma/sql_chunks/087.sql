-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

