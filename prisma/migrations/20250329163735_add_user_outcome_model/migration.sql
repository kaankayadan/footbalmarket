-- CreateTable
CREATE TABLE "UserOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL DEFAULT 0,
    "avgPrice" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserOutcome_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
