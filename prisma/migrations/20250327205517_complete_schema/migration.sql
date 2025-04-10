-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "balance" DECIMAL NOT NULL DEFAULT 1000
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "creatorId" TEXT NOT NULL,
    "volume" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "Market_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Outcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "marketId" TEXT NOT NULL,
    "probability" DECIMAL NOT NULL DEFAULT 0,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Outcome_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "price" DECIMAL NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trade_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trade_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
