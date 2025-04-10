/*
  Warnings:

  - Added the required column `updatedAt` to the `UserOutcome` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL DEFAULT 0,
    "avgPrice" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserOutcome_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserOutcome" ("avgPrice", "createdAt", "id", "outcomeId", "quantity", "userId") SELECT "avgPrice", "createdAt", "id", "outcomeId", "quantity", "userId" FROM "UserOutcome";
DROP TABLE "UserOutcome";
ALTER TABLE "new_UserOutcome" RENAME TO "UserOutcome";
CREATE UNIQUE INDEX "UserOutcome_userId_outcomeId_key" ON "UserOutcome"("userId", "outcomeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
