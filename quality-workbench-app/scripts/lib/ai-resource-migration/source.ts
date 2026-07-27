import fs from 'node:fs';
import Database from 'better-sqlite3';
import type { SourceCounts } from './shared';

export type SourceUser = {
  id: string;
  dingUserId: string;
  unionId: string | null;
  name: string;
  avatarUrl: string | null;
  departmentIds: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export type SourceResource = {
  id: string;
  name: string;
  type: string;
  summary: string;
  tags: string;
  ownerName: string;
  visibilityScope: string;
  visibleDeptIds: string;
  visibleUserIds: string;
  status: string;
  resourceUrl: string | null;
  content: string;
  attachments: string | null;
  extension: string | null;
  extractedText: string | null;
  currentVersion: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  createdById: string;
};

export type SourceReviewRequest = {
  id: string;
  type: string;
  status: string;
  resourceId: string | null;
  proposedData: string;
  updateSummary: string;
  changedFields: string;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  requesterId: string;
  reviewerId: string | null;
};

export type SourceUpdateLog = {
  id: string;
  resourceId: string;
  actorId: string;
  reviewerId: string | null;
  reviewId: string | null;
  action: string;
  result: string;
  updateSummary: string;
  changedFields: string;
  createdAt: string;
};

export type SourceFavorite = {
  id: string;
  userId: string;
  resourceId: string;
  createdAt: string;
};

export type SourceSnapshot = {
  counts: SourceCounts;
  users: SourceUser[];
  resources: SourceResource[];
  reviewRequests: SourceReviewRequest[];
  updateLogs: SourceUpdateLog[];
  favorites: SourceFavorite[];
};

export function openSourceDatabase(sqlitePath: string): Database.Database {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SOURCE_SQLITE_PATH does not exist: ${sqlitePath}`);
  }
  return new Database(sqlitePath, { readonly: true, fileMustExist: true });
}

export function readSourceSnapshot(db: Database.Database): SourceSnapshot {
  const users = db.prepare('SELECT * FROM "User" ORDER BY "createdAt" ASC').all() as SourceUser[];
  const resources = db
    .prepare('SELECT * FROM "Resource" ORDER BY "createdAt" ASC')
    .all() as SourceResource[];
  const reviewRequests = db
    .prepare('SELECT * FROM "ReviewRequest" ORDER BY "createdAt" ASC')
    .all() as SourceReviewRequest[];
  const updateLogs = db
    .prepare('SELECT * FROM "UpdateLog" ORDER BY "createdAt" ASC')
    .all() as SourceUpdateLog[];
  const favorites = db
    .prepare('SELECT * FROM "Favorite" ORDER BY "createdAt" ASC')
    .all() as SourceFavorite[];

  return {
    counts: {
      users: users.length,
      resources: resources.length,
      reviewRequests: reviewRequests.length,
      updateLogs: updateLogs.length,
      favorites: favorites.length,
    },
    users,
    resources,
    reviewRequests,
    updateLogs,
    favorites,
  };
}
