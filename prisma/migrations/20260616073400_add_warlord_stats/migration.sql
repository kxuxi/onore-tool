-- AlterTable: 武将ランキング取り込み用の能力値・自己PR列を追加（すべて任意・後方互換）
ALTER TABLE "Warlord" ADD COLUMN     "power" INTEGER,
ADD COLUMN     "intelligence" INTEGER,
ADD COLUMN     "leadership" INTEGER,
ADD COLUMN     "politics" INTEGER,
ADD COLUMN     "strategy" DOUBLE PRECISION,
ADD COLUMN     "selfPr" TEXT,
ADD COLUMN     "statsRaw" TEXT;
