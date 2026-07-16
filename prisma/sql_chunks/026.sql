-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentValue" DECIMAL(24,8) NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

