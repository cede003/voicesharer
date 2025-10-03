-- AlterTable
ALTER TABLE "Recording" ADD COLUMN     "lastPlayedAt" TIMESTAMP(3),
ADD COLUMN     "playCount" INTEGER NOT NULL DEFAULT 0;
