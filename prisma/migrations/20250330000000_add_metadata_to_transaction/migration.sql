-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("id", "userId", "amount", "type", "createdAt") SELECT "id", "userId", "amount", "type", "createdAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;