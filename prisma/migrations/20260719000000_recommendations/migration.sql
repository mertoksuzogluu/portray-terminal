-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE "RiskProfile" AS ENUM ('CONSERVATIVE', 'BALANCED', 'GROWTH', 'AGGRESSIVE');
CREATE TYPE "AssetClass" AS ENUM ('EQUITY', 'FUND', 'FX', 'GOLD', 'CASH');
CREATE TYPE "RecommendationAction" AS ENUM ('INCREASE', 'DECREASE', 'HOLD', 'SHIFT_CLASS', 'PARK_CASH');
CREATE TYPE "RecommendationStatus" AS ENUM ('ACTIVE', 'APPLIED', 'DISMISSED', 'EXPIRED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "riskProfile" "RiskProfile" NOT NULL DEFAULT 'BALANCED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "target_allocations" (
    "id" TEXT NOT NULL,
    "riskProfile" "RiskProfile" NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "weight" DECIMAL(12,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "target_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "target_allocations_riskProfile_assetClass_key" ON "target_allocations"("riskProfile", "assetClass");
CREATE INDEX IF NOT EXISTS "target_allocations_riskProfile_idx" ON "target_allocations"("riskProfile");

CREATE TABLE IF NOT EXISTS "recommendation_runs" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "runDate" DATE NOT NULL,
    "algorithmVersion" TEXT NOT NULL DEFAULT 'v1',
    "riskProfile" "RiskProfile" NOT NULL,
    "riskScore" DECIMAL(12,4),
    "inputSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recommendation_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recommendation_runs_portfolioId_runDate_algorithmVersion_key" ON "recommendation_runs"("portfolioId", "runDate", "algorithmVersion");
CREATE INDEX IF NOT EXISTS "recommendation_runs_portfolioId_runDate_idx" ON "recommendation_runs"("portfolioId", "runDate");

CREATE TABLE IF NOT EXISTS "recommendations" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "action" "RecommendationAction" NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "assetId" TEXT,
    "symbol" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "currentWeight" DECIMAL(12,8) NOT NULL,
    "targetWeight" DECIMAL(12,8) NOT NULL,
    "suggestedDelta" DECIMAL(12,8) NOT NULL,
    "score" DECIMAL(12,4) NOT NULL,
    "rationale" JSONB,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
    "validUntil" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "recommendations_portfolioId_status_idx" ON "recommendations"("portfolioId", "status");
CREATE INDEX IF NOT EXISTS "recommendations_runId_idx" ON "recommendations"("runId");
CREATE INDEX IF NOT EXISTS "recommendations_validUntil_idx" ON "recommendations"("validUntil");

CREATE TABLE IF NOT EXISTS "market_notes" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "market_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "market_notes_isActive_publishedAt_idx" ON "market_notes"("isActive", "publishedAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_runId_fkey" FOREIGN KEY ("runId") REFERENCES "recommendation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "market_notes" ADD CONSTRAINT "market_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
