-- Email ownership. Additive only: existing rows keep working with the old code.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Google already proved these addresses
UPDATE "User" SET "emailVerified" = true WHERE "googleId" IS NOT NULL AND "email" IS NOT NULL;

-- AlterTable
ALTER TABLE "PasswordReset" ADD COLUMN "email" TEXT;

-- Reset tokens are now stored as SHA-256 digests; plaintext ones can't be redeemed anymore
UPDATE "PasswordReset" SET "used" = true WHERE "used" = false;

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_token_key" ON "EmailVerification"("token");

-- CreateIndex
CREATE INDEX "EmailVerification_userId_idx" ON "EmailVerification"("userId");

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same as every other table: no PostgREST access, Prisma bypasses RLS as owner
ALTER TABLE "EmailVerification" ENABLE ROW LEVEL SECURITY;
