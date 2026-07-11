-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "repoUrl" TEXT NOT NULL DEFAULT '',
    "repoPath" TEXT NOT NULL DEFAULT '',
    "githubRepo" TEXT NOT NULL DEFAULT '',
    "webhookSecret" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Project" ("createdAt", "description", "id", "name", "repoPath", "repoUrl") SELECT "createdAt", "description", "id", "name", "repoPath", "repoUrl" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE TABLE "new_Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'backlog',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "feasibilityNotes" TEXT NOT NULL DEFAULT '',
    "feasibilityResult" TEXT NOT NULL DEFAULT '',
    "feasibilityAgent" TEXT NOT NULL DEFAULT 'openclaw',
    "developmentNotes" TEXT NOT NULL DEFAULT '',
    "developmentAgent" TEXT NOT NULL DEFAULT 'openclaw',
    "commitSha" TEXT NOT NULL DEFAULT '',
    "branchName" TEXT NOT NULL DEFAULT '',
    "qaNotes" TEXT NOT NULL DEFAULT '',
    "qaResult" TEXT NOT NULL DEFAULT '',
    "labels" TEXT NOT NULL DEFAULT '[]',
    "assignee" TEXT NOT NULL DEFAULT '',
    "reporter" TEXT NOT NULL DEFAULT 'user',
    "githubIssueNumber" INTEGER,
    "githubIssueUrl" TEXT NOT NULL DEFAULT '',
    "projectId" TEXT,
    CONSTRAINT "Ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Ticket" ("assignee", "branchName", "commitSha", "createdAt", "description", "developmentAgent", "developmentNotes", "feasibilityAgent", "feasibilityNotes", "feasibilityResult", "id", "labels", "order", "priority", "projectId", "qaNotes", "qaResult", "reporter", "status", "title", "updatedAt") SELECT "assignee", "branchName", "commitSha", "createdAt", "description", "developmentAgent", "developmentNotes", "feasibilityAgent", "feasibilityNotes", "feasibilityResult", "id", "labels", "order", "priority", "projectId", "qaNotes", "qaResult", "reporter", "status", "title", "updatedAt" FROM "Ticket";
DROP TABLE "Ticket";
ALTER TABLE "new_Ticket" RENAME TO "Ticket";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
