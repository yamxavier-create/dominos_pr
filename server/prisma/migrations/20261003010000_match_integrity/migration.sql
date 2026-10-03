-- Match integrity. Additive only: existing rows keep working with the old code.
-- Older games have no matchId and stay ranked (there's no way to tell them apart now).

-- AlterTable
ALTER TABLE "GameHistory" ADD COLUMN "matchId" TEXT,
ADD COLUMN "ranked" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "GameParticipant" ADD COLUMN "replacedByBot" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "GameHistory_matchId_key" ON "GameHistory"("matchId");
