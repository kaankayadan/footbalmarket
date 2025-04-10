-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "balance" DECIMAL NOT NULL DEFAULT 1000,
    "isAdmin" BOOLEAN DEFAULT false
);
INSERT INTO "new_User" ("balance", "createdAt", "email", "emailVerified", "id", "image", "isAdmin", "name", "password", "updatedAt") SELECT "balance", "createdAt", "email", "emailVerified", "id", "image", "isAdmin", "name", "password", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
