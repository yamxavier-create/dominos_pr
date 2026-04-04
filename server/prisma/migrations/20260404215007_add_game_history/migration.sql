-- CreateTable
CREATE TABLE "GameHistory" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "gameMode" TEXT NOT NULL,
    "winningTeam" INTEGER NOT NULL,
    "totalRounds" INTEGER NOT NULL,
    "scoreTeam0" INTEGER NOT NULL,
    "scoreTeam1" INTEGER NOT NULL,
    "playerCount" INTEGER NOT NULL DEFAULT 4,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "id" TEXT NOT NULL,
    "gameHistoryId" TEXT NOT NULL,
    "userId" TEXT,
    "playerName" TEXT NOT NULL,
    "playerIndex" INTEGER NOT NULL,
    "team" INTEGER NOT NULL,
    "won" BOOLEAN NOT NULL,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameHistory_endedAt_idx" ON "GameHistory"("endedAt");

-- CreateIndex
CREATE INDEX "GameParticipant_userId_idx" ON "GameParticipant"("userId");

-- CreateIndex
CREATE INDEX "GameParticipant_gameHistoryId_idx" ON "GameParticipant"("gameHistoryId");

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_gameHistoryId_fkey" FOREIGN KEY ("gameHistoryId") REFERENCES "GameHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
