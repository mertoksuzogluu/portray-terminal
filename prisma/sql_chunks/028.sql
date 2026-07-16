-- CreateTable
CREATE TABLE "data_sync_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "data_sync_logs_pkey" PRIMARY KEY ("id")
);

