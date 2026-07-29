-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "cadence" TEXT NOT NULL DEFAULT 'biweekly',
    "nextPay" TIMESTAMP(3),
    "payAmount" DECIMAL(12,2) NOT NULL DEFAULT 1700,
    "primaryName" TEXT NOT NULL DEFAULT 'Main checking',
    "primaryBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "primaryLogo" TEXT,
    "notifBills" BOOLEAN NOT NULL DEFAULT true,
    "notifWeekly" BOOLEAN NOT NULL DEFAULT false,
    "onboardedAt" TIMESTAMP(3),

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "logo" TEXT,
    "plaidItemId" TEXT,
    "plaidAccountId" TEXT,
    "plaidAccessToken" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "kind" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "cycle" TEXT NOT NULL DEFAULT 'monthly',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "payFrom" TEXT,
    "cardId" TEXT,
    "oneTime" BOOLEAN NOT NULL DEFAULT false,
    "personal" BOOLEAN NOT NULL DEFAULT false,
    "lender" TEXT,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "spent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Txn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "cat" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "src" TEXT,
    "cardId" TEXT,
    "billId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "plaidTransactionId" TEXT,

    CONSTRAINT "Txn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" DECIMAL(12,2) NOT NULL,
    "saved" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "per" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "due" TIMESTAMP(3),
    "necessity" BOOLEAN NOT NULL DEFAULT false,
    "paused" TEXT,
    "behind" BOOLEAN NOT NULL DEFAULT false,
    "financed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "financedFrom" TEXT,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apr" DECIMAL(5,2) NOT NULL,
    "limit" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dueDay" INTEGER,
    "minPay" DECIMAL(12,2),
    "payInFull" BOOLEAN NOT NULL DEFAULT false,
    "rewards" JSONB NOT NULL DEFAULT '[]',
    "promoRate" DECIMAL(5,2),
    "promoEnd" TIMESTAMP(3),
    "balanceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Bill_userId_idx" ON "Bill"("userId");

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE INDEX "Txn_userId_idx" ON "Txn"("userId");

-- CreateIndex
CREATE INDEX "Txn_userId_deletedAt_idx" ON "Txn"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "Card_userId_idx" ON "Card"("userId");
