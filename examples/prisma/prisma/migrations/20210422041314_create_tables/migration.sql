-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "secret" TEXT,
    "redirectUris" TEXT NOT NULL,
    "allowedGrants" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "OAuthAuthCode" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "redirectUri" TEXT,
    "codeChallenge" TEXT,
    "codeChallengeMethod" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "userId" INTEGER,
    "oAuthClientId" TEXT NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("oAuthClientId") REFERENCES "OAuthClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "accessToken" TEXT NOT NULL PRIMARY KEY,
    "accessTokenExpiresAt" DATETIME NOT NULL,
    "refreshToken" TEXT,
    "refreshTokenExpiresAt" DATETIME,
    "oAuthClientId" TEXT NOT NULL,
    "userId" INTEGER,
    FOREIGN KEY ("oAuthClientId") REFERENCES "OAuthClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OAuthScope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "oAuthAuthCodeCode" TEXT,
    "oAuthTokenAccessToken" TEXT,
    "oAuthClientId" TEXT,
    FOREIGN KEY ("oAuthAuthCodeCode") REFERENCES "OAuthAuthCode" ("code") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("oAuthTokenAccessToken") REFERENCES "OAuthToken" ("accessToken") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("oAuthClientId") REFERENCES "OAuthClient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User.email_unique" ON "User"("email");
