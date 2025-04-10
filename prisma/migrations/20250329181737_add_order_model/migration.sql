-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "price" DECIMAL NOT NULL,
    "filled" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
