-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SessionAssurance" AS ENUM ('PASSWORD', 'SETUP_LINK', 'SECOND_FACTOR');

-- CreateEnum
CREATE TYPE "DivisionPosition" AS ENUM ('TOP_LEFT', 'BOTTOM_LEFT', 'TOP_RIGHT', 'BOTTOM_RIGHT');

-- CreateEnum
CREATE TYPE "Round" AS ENUM ('WILD_CARD', 'ROUND_1', 'ROUND_2', 'SWEET_16', 'ELITE_TRAIT', 'FINAL_ROAR', 'CHAMPIONSHIP');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('RUDE', 'FULL_NAME', 'NOT_REAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PlayerDeleter" AS ENUM ('EDUCATOR', 'PLAYER');

-- CreateEnum
CREATE TYPE "PickStage" AS ENUM ('DRAFT', 'SUBMISSION');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Educator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "launchEmailedAt" TIMESTAMP(3),
    "organizationDomain" TEXT,

    CONSTRAINT "Educator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "domain" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("domain")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "assurance" "SessionAssurance" NOT NULL DEFAULT 'PASSWORD',
    "secondFactorUsedAt" TIMESTAMP(3),
    "educatorId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "educatorId" TEXT NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "aaguid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "educatorId" TEXT NOT NULL,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthenticatorApp" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "educatorId" TEXT NOT NULL,

    CONSTRAINT "AuthenticatorApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bracket" (
    "year" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "expectedLockDate" DATE,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bracket_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "position" "DivisionPosition" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeedSlot" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "combatantId" TEXT,

    CONSTRAINT "SeedSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Combatant" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mergedIntoId" TEXT,

    CONSTRAINT "Combatant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WildCard" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seedSlotId" TEXT NOT NULL,

    CONSTRAINT "WildCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WildCardEntrant" (
    "wildCardId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "combatantId" TEXT NOT NULL,

    CONSTRAINT "WildCardEntrant_pkey" PRIMARY KEY ("wildCardId","index")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "round" "Round" NOT NULL,
    "index" INTEGER NOT NULL,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "battleId" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("battleId")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "educatorId" TEXT,
    "orphanedFromDomain" TEXT,
    "name" TEXT NOT NULL,
    "linkSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "linkVersion" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "isHidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "playerId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDismissedByEducator" BOOLEAN NOT NULL DEFAULT false,
    "isDismissedByAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Share" (
    "contestId" TEXT NOT NULL,
    "educatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("contestId","educatorId")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "personalLinkHash" TEXT NOT NULL,
    "linkVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "picksClearedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedBy" "PlayerDeleter",

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "playerId" TEXT NOT NULL,
    "stage" "PickStage" NOT NULL,
    "battleId" TEXT NOT NULL,
    "combatantId" TEXT NOT NULL,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("playerId","stage","battleId")
);

-- CreateTable
CREATE TABLE "Submission" (
    "playerId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "picksChangedAt" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("playerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Educator_email_key" ON "Educator"("email");

-- CreateIndex
CREATE INDEX "Educator_organizationDomain_idx" ON "Educator"("organizationDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_educatorId_idx" ON "Session"("educatorId");

-- CreateIndex
CREATE INDEX "Credential_educatorId_idx" ON "Credential"("educatorId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "Passkey_educatorId_idx" ON "Passkey"("educatorId");

-- CreateIndex
CREATE INDEX "Passkey_credentialID_idx" ON "Passkey"("credentialID");

-- CreateIndex
CREATE INDEX "AuthenticatorApp_educatorId_idx" ON "AuthenticatorApp"("educatorId");

-- CreateIndex
CREATE INDEX "AuthenticatorApp_secret_idx" ON "AuthenticatorApp"("secret");

-- CreateIndex
CREATE UNIQUE INDEX "Division_year_position_key" ON "Division"("year", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Division_year_name_key" ON "Division"("year", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SeedSlot_combatantId_key" ON "SeedSlot"("combatantId");

-- CreateIndex
CREATE UNIQUE INDEX "SeedSlot_divisionId_seed_key" ON "SeedSlot"("divisionId", "seed");

-- CreateIndex
CREATE INDEX "Combatant_mergedIntoId_idx" ON "Combatant"("mergedIntoId");

-- CreateIndex
CREATE UNIQUE INDEX "Combatant_year_name_key" ON "Combatant"("year", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WildCard_year_key" ON "WildCard"("year");

-- CreateIndex
CREATE UNIQUE INDEX "WildCard_seedSlotId_key" ON "WildCard"("seedSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "WildCardEntrant_combatantId_key" ON "WildCardEntrant"("combatantId");

-- CreateIndex
CREATE UNIQUE INDEX "Battle_year_round_index_key" ON "Battle"("year", "round", "index");

-- CreateIndex
CREATE INDEX "Result_winnerId_idx" ON "Result"("winnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_linkSecret_key" ON "Contest"("linkSecret");

-- CreateIndex
CREATE INDEX "Contest_orphanedFromDomain_idx" ON "Contest"("orphanedFromDomain");

-- CreateIndex
CREATE INDEX "Contest_educatorId_year_idx" ON "Contest"("educatorId", "year");

-- CreateIndex
CREATE INDEX "Contest_year_idx" ON "Contest"("year");

-- CreateIndex
CREATE INDEX "Report_contestId_idx" ON "Report"("contestId");

-- CreateIndex
CREATE INDEX "Report_playerId_idx" ON "Report"("playerId");

-- CreateIndex
CREATE INDEX "Share_educatorId_idx" ON "Share"("educatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_personalLinkHash_key" ON "Player"("personalLinkHash");

-- CreateIndex
CREATE INDEX "Player_contestId_idx" ON "Player"("contestId");

-- CreateIndex
CREATE INDEX "Pick_battleId_idx" ON "Pick"("battleId");

-- CreateIndex
CREATE INDEX "Pick_combatantId_idx" ON "Pick"("combatantId");

-- AddForeignKey
ALTER TABLE "Educator" ADD CONSTRAINT "Educator_organizationDomain_fkey" FOREIGN KEY ("organizationDomain") REFERENCES "Organization"("domain") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "Educator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "Educator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "Educator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthenticatorApp" ADD CONSTRAINT "AuthenticatorApp_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "Educator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_year_fkey" FOREIGN KEY ("year") REFERENCES "Bracket"("year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeedSlot" ADD CONSTRAINT "SeedSlot_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeedSlot" ADD CONSTRAINT "SeedSlot_combatantId_fkey" FOREIGN KEY ("combatantId") REFERENCES "Combatant"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combatant" ADD CONSTRAINT "Combatant_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Combatant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combatant" ADD CONSTRAINT "Combatant_year_fkey" FOREIGN KEY ("year") REFERENCES "Bracket"("year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WildCard" ADD CONSTRAINT "WildCard_year_fkey" FOREIGN KEY ("year") REFERENCES "Bracket"("year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WildCard" ADD CONSTRAINT "WildCard_seedSlotId_fkey" FOREIGN KEY ("seedSlotId") REFERENCES "SeedSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WildCardEntrant" ADD CONSTRAINT "WildCardEntrant_wildCardId_fkey" FOREIGN KEY ("wildCardId") REFERENCES "WildCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WildCardEntrant" ADD CONSTRAINT "WildCardEntrant_combatantId_fkey" FOREIGN KEY ("combatantId") REFERENCES "Combatant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_year_fkey" FOREIGN KEY ("year") REFERENCES "Bracket"("year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Combatant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_year_fkey" FOREIGN KEY ("year") REFERENCES "Bracket"("year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "Educator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_orphanedFromDomain_fkey" FOREIGN KEY ("orphanedFromDomain") REFERENCES "Organization"("domain") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "Educator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_combatantId_fkey" FOREIGN KEY ("combatantId") REFERENCES "Combatant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CHECK constraints
ALTER TABLE "SeedSlot" DROP CONSTRAINT IF EXISTS "SeedSlot_seed_check", ADD CONSTRAINT "SeedSlot_seed_check" CHECK (seed BETWEEN 1 AND 16);
ALTER TABLE "WildCardEntrant" DROP CONSTRAINT IF EXISTS "WildCardEntrant_index_check", ADD CONSTRAINT "WildCardEntrant_index_check" CHECK (index BETWEEN 0 AND 3);
ALTER TABLE "Battle" DROP CONSTRAINT IF EXISTS "Battle_index_check", ADD CONSTRAINT "Battle_index_check" CHECK (index >= 0 AND index < CASE round WHEN 'WILD_CARD' THEN 1 WHEN 'ROUND_1' THEN 32 WHEN 'ROUND_2' THEN 16 WHEN 'SWEET_16' THEN 8 WHEN 'ELITE_TRAIT' THEN 4 WHEN 'FINAL_ROAR' THEN 2 WHEN 'CHAMPIONSHIP' THEN 1 ELSE 0 END);
ALTER TABLE "Division" DROP CONSTRAINT IF EXISTS "Division_name_check", ADD CONSTRAINT "Division_name_check" CHECK ("name" = btrim("name") AND char_length("name") BETWEEN 1 AND 80);
ALTER TABLE "Combatant" DROP CONSTRAINT IF EXISTS "Combatant_name_check", ADD CONSTRAINT "Combatant_name_check" CHECK ("name" = btrim("name") AND char_length("name") BETWEEN 1 AND 80);
ALTER TABLE "Contest" DROP CONSTRAINT IF EXISTS "Contest_name_check", ADD CONSTRAINT "Contest_name_check" CHECK ("name" = btrim("name") AND char_length("name") BETWEEN 1 AND 80);
ALTER TABLE "Contest" DROP CONSTRAINT IF EXISTS "Contest_orphanedFromDomain_check", ADD CONSTRAINT "Contest_orphanedFromDomain_check" CHECK ("educatorId" IS NULL OR "orphanedFromDomain" IS NULL);
ALTER TABLE "Organization" DROP CONSTRAINT IF EXISTS "Organization_name_check", ADD CONSTRAINT "Organization_name_check" CHECK ("name" = btrim("name") AND char_length("name") BETWEEN 1 AND 80);
ALTER TABLE "Player" DROP CONSTRAINT IF EXISTS "Player_displayName_check", ADD CONSTRAINT "Player_displayName_check" CHECK ("displayName" = btrim("displayName") AND char_length("displayName") BETWEEN 1 AND 30);
ALTER TABLE "Player" DROP CONSTRAINT IF EXISTS "Player_deletedBy_check", ADD CONSTRAINT "Player_deletedBy_check" CHECK (("deletedAt" IS NULL) = ("deletedBy" IS NULL));
