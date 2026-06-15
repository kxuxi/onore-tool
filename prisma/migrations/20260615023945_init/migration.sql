-- CreateTable
CREATE TABLE "UnitType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "goodAgainst" TEXT NOT NULL DEFAULT '',
    "attack" INTEGER NOT NULL DEFAULT 0,
    "defense" INTEGER NOT NULL DEFAULT 0,
    "cost" TEXT NOT NULL DEFAULT '',
    "tech" TEXT NOT NULL DEFAULT '',
    "years" TEXT NOT NULL DEFAULT '',
    "reqStats" TEXT NOT NULL DEFAULT '',
    "facility" TEXT NOT NULL DEFAULT '',
    "special" TEXT NOT NULL DEFAULT '',
    "bonus" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warlord" (
    "name" TEXT NOT NULL,
    "faction" TEXT,
    "type" TEXT NOT NULL DEFAULT '',
    "branch" TEXT NOT NULL DEFAULT '',
    "unit" TEXT,
    "battleAt" TEXT,
    "lastActionAt" TEXT,
    "actions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Warlord_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "BattleRecord" (
    "id" SERIAL NOT NULL,
    "line" TEXT NOT NULL,
    "raw" TEXT NOT NULL DEFAULT '',
    "time" TEXT,
    "savedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "BattleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitType_name_key" ON "UnitType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BattleRecord_line_key" ON "BattleRecord"("line");
