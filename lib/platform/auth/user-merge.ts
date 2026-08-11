import type { DatabaseClient } from '@/lib/database';

export type UserMergeIdentity = {
  issuer: string;
  subject: string;
  authingExternalId: string;
  externalId: string | null;
  username: string;
  email: string | null;
  unionid: string | null;
  dingtalkUserId: string | null;
};

export type UserMergeCandidate = {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  platform_role: string;
  role: string;
  status: string;
  has_authing_identity: boolean;
  username_match: boolean;
  email_match: boolean;
  unionid_match: boolean;
  userid_match: boolean;
};

/**
 * Select only a deterministic, strong identity match for automatic merging.
 * Email-only matches are intentionally left for manual review.
 */
export function selectSafeUserMergeCandidate(candidates: UserMergeCandidate[]) {
  const identityMatches = candidates.filter((candidate) => candidate.has_authing_identity);
  if (identityMatches.length === 1) return identityMatches[0] ?? null;
  if (identityMatches.length > 1) return null;

  const providerMatches = candidates.filter((candidate) => (
    candidate.unionid_match || candidate.userid_match
  ));
  if (providerMatches.length === 1) return providerMatches[0] ?? null;
  if (providerMatches.length > 1) return null;

  const usernameMatches = candidates.filter((candidate) => candidate.username_match);
  if (usernameMatches.length === 1) return usernameMatches[0] ?? null;
  return null;
}

export async function findUserMergeCandidates(
  transaction: DatabaseClient,
  identity: UserMergeIdentity,
) {
  return transaction.$queryRaw<UserMergeCandidate[]>`
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.email,
      u.platform_role,
      u.role,
      u.status,
      (
        EXISTS (
          SELECT 1
          FROM user_identities AS ui
          WHERE ui.user_id = u.id
            AND ui.provider = 'authing'
            AND ui.issuer = ${identity.issuer}
            AND ui.subject = ${identity.subject}
        )
        OR (
          u.external_source = 'authing'
          AND (
            u.external_id = ${identity.authingExternalId}
            OR (
              ${identity.externalId}::text IS NOT NULL
              AND u.external_id_authing = ${identity.externalId}::text
            )
          )
        )
      ) AS has_authing_identity,
      (u.username = ${identity.username}) AS username_match,
      (
        ${identity.email}::text IS NOT NULL
        AND lower(u.email) = lower(${identity.email}::text)
      ) AS email_match,
      (
        u.unionid = ${identity.unionid}
        OR (u.external_source = 'dingtalk' AND u.external_id = ${identity.unionid})
      ) AS unionid_match,
      (u.dingtalk_user_id = ${identity.dingtalkUserId}) AS userid_match
    FROM users AS u
    WHERE u.username = ${identity.username}
       OR (
         ${identity.email}::text IS NOT NULL
         AND lower(u.email) = lower(${identity.email}::text)
       )
       OR u.unionid = ${identity.unionid}
       OR (u.external_source = 'dingtalk' AND u.external_id = ${identity.unionid})
       OR u.dingtalk_user_id = ${identity.dingtalkUserId}
       OR (
         u.external_source = 'authing'
         AND (
           u.external_id = ${identity.authingExternalId}
           OR (
             ${identity.externalId}::text IS NOT NULL
             AND u.external_id_authing = ${identity.externalId}::text
           )
         )
       )
       OR EXISTS (
         SELECT 1
         FROM user_identities AS ui
         WHERE ui.user_id = u.id
           AND ui.provider = 'authing'
           AND ui.issuer = ${identity.issuer}
           AND ui.subject = ${identity.subject}
       )
    ORDER BY has_authing_identity DESC, username_match DESC, unionid_match DESC, userid_match DESC, email_match DESC, u.created_at ASC
  `;
}

const PLATFORM_ROLE_RANK: Record<string, number> = {
  user: 0,
  admin: 1,
};

const WORKBENCH_ROLE_RANK: Record<string, number> = {
  user: 0,
  manager: 1,
  reviewer: 1,
  admin: 2,
};

function higherRole(
  first: string,
  second: string,
  rank: Record<string, number>,
) {
  return (rank[first] ?? 0) >= (rank[second] ?? 0) ? first : second;
}

async function mergeOneUser(
  transaction: DatabaseClient,
  primaryUserId: string,
  duplicateUserId: string,
  preferredEmail: string | null,
) {
  if (primaryUserId === duplicateUserId) return false;

  const rows = await transaction.$queryRaw<{
    id: string;
    platform_role: string;
    role: string;
    directory_user_id: string | null;
    status: string;
    external_source: string | null;
  }[]>`
    SELECT id, platform_role, role, directory_user_id, status, external_source
    FROM users
    WHERE id IN (${primaryUserId}, ${duplicateUserId})
    FOR UPDATE
  `;
  const primary = rows.find((row) => row.id === primaryUserId);
  const duplicate = rows.find((row) => row.id === duplicateUserId);
  if (!primary || !duplicate) return false;
  if (duplicate.status === 'disabled' && duplicate.external_source === 'merged') {
    return false;
  }

  await transaction.$queryRaw`
    UPDATE users AS primary_user
    SET platform_role = ${higherRole(primary.platform_role, duplicate.platform_role, PLATFORM_ROLE_RANK)},
        role = ${higherRole(primary.role, duplicate.role, WORKBENCH_ROLE_RANK)},
        avatar = COALESCE(primary_user.avatar, duplicate_user.avatar),
        supervisor_dingtalk_user_id = COALESCE(
          primary_user.supervisor_dingtalk_user_id,
          duplicate_user.supervisor_dingtalk_user_id
        ),
        supervisor_name = COALESCE(primary_user.supervisor_name, duplicate_user.supervisor_name),
        directory_supervisor_user_id = COALESCE(
          primary_user.directory_supervisor_user_id,
          duplicate_user.directory_supervisor_user_id
        ),
        directory_supervisor_name = COALESCE(
          primary_user.directory_supervisor_name,
          duplicate_user.directory_supervisor_name
        ),
        sync_at = COALESCE(
          GREATEST(primary_user.sync_at, duplicate_user.sync_at),
          primary_user.sync_at,
          duplicate_user.sync_at
        )
    FROM users AS duplicate_user
    WHERE primary_user.id = ${primaryUserId}
      AND duplicate_user.id = ${duplicateUserId}
  `;

  if (!primary.directory_user_id && duplicate.directory_user_id) {
    await transaction.$queryRaw`
      UPDATE users
      SET directory_user_id = NULL
      WHERE id = ${duplicateUserId}
    `;
    await transaction.$queryRaw`
      UPDATE users
      SET directory_user_id = ${duplicate.directory_user_id}
      WHERE id = ${primaryUserId}
    `;
  }

  await transaction.$queryRaw`
    DELETE FROM user_identities AS duplicate_identity
    WHERE duplicate_identity.user_id = ${duplicateUserId}
      AND EXISTS (
        SELECT 1
        FROM user_identities AS primary_identity
        WHERE primary_identity.user_id = ${primaryUserId}
          AND primary_identity.provider = duplicate_identity.provider
          AND primary_identity.issuer = duplicate_identity.issuer
      )
  `;
  await transaction.$queryRaw`
    UPDATE user_identities
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;

  await transaction.$queryRaw`
    DELETE FROM user_dingtalk_departments AS duplicate_department
    WHERE duplicate_department.user_id = ${duplicateUserId}
      AND EXISTS (
        SELECT 1
        FROM user_dingtalk_departments AS primary_department
        WHERE primary_department.user_id = ${primaryUserId}
          AND primary_department.department_id = duplicate_department.department_id
      )
  `;
  await transaction.$queryRaw`
    UPDATE user_dingtalk_departments
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;

  await transaction.$queryRaw`
    UPDATE tasks AS task
    SET assignee_member_id = primary_member.id
    FROM project_members AS duplicate_member
    JOIN project_members AS primary_member
      ON primary_member.project_id = duplicate_member.project_id
     AND primary_member.user_id = ${primaryUserId}
    WHERE duplicate_member.user_id = ${duplicateUserId}
      AND task.assignee_member_id = duplicate_member.id
  `;
  await transaction.$queryRaw`
    DELETE FROM project_members AS duplicate_member
    WHERE duplicate_member.user_id = ${duplicateUserId}
      AND EXISTS (
        SELECT 1
        FROM project_members AS primary_member
        WHERE primary_member.project_id = duplicate_member.project_id
          AND primary_member.user_id = ${primaryUserId}
      )
  `;
  await transaction.$queryRaw`
    UPDATE project_members
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;

  await transaction.$queryRaw`
    DELETE FROM user_positions AS duplicate_position
    WHERE duplicate_position.user_id = ${duplicateUserId}
      AND EXISTS (
        SELECT 1
        FROM user_positions AS primary_position
        WHERE primary_position.user_id = ${primaryUserId}
      )
  `;
  await transaction.$queryRaw`
    UPDATE user_positions
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;

  await transaction.$queryRaw`
    DELETE FROM project_position_assignments AS duplicate_assignment
    WHERE duplicate_assignment.user_id = ${duplicateUserId}
      AND EXISTS (
        SELECT 1
        FROM project_position_assignments AS primary_assignment
        WHERE primary_assignment.project_id = duplicate_assignment.project_id
          AND primary_assignment.position_role_id = duplicate_assignment.position_role_id
      )
  `;
  await transaction.$queryRaw`
    UPDATE project_position_assignments
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE project_position_assignments
    SET appointed_by_id = ${primaryUserId}
    WHERE appointed_by_id = ${duplicateUserId}
  `;

  await transaction.$queryRaw`
    UPDATE ai_resource_memberships AS primary_membership
    SET role = CASE
      WHEN primary_membership.role = 'admin'
        OR duplicate_membership.role = 'admin' THEN 'admin'
      WHEN primary_membership.role = 'reviewer'
        OR duplicate_membership.role = 'reviewer' THEN 'reviewer'
      ELSE 'user'
    END
    FROM ai_resource_memberships AS duplicate_membership
    WHERE primary_membership.user_id = ${primaryUserId}
      AND duplicate_membership.user_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    DELETE FROM ai_resource_memberships AS duplicate_membership
    WHERE duplicate_membership.user_id = ${duplicateUserId}
      AND EXISTS (
        SELECT 1
        FROM ai_resource_memberships AS primary_membership
        WHERE primary_membership.user_id = ${primaryUserId}
      )
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_memberships
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;

  await transaction.$queryRaw`
    UPDATE ai_resource_favorites AS favorite
    SET tag_id = primary_tag.id
    FROM ai_resource_favorite_tags AS duplicate_tag
    JOIN ai_resource_favorite_tags AS primary_tag
      ON primary_tag.user_id = ${primaryUserId}
     AND primary_tag.name = duplicate_tag.name
    WHERE duplicate_tag.user_id = ${duplicateUserId}
      AND favorite.tag_id = duplicate_tag.id
  `;
  await transaction.$queryRaw`
    DELETE FROM ai_resource_favorite_tags AS duplicate_tag
    WHERE duplicate_tag.user_id = ${duplicateUserId}
      AND EXISTS (
        SELECT 1
        FROM ai_resource_favorite_tags AS primary_tag
        WHERE primary_tag.user_id = ${primaryUserId}
          AND primary_tag.name = duplicate_tag.name
      )
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_favorite_tags
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;

  await transaction.$queryRaw`
    DELETE FROM ai_resource_favorites AS duplicate_favorite
    WHERE duplicate_favorite.user_id = ${duplicateUserId}
      AND EXISTS (
        SELECT 1
        FROM ai_resource_favorites AS primary_favorite
        WHERE primary_favorite.user_id = ${primaryUserId}
          AND primary_favorite.resource_id = duplicate_favorite.resource_id
      )
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_favorites
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;

  await transaction.$queryRaw`
    DELETE FROM ai_resource_likes AS duplicate_like
    WHERE duplicate_like.user_id = ${duplicateUserId}
      AND EXISTS (
        SELECT 1
        FROM ai_resource_likes AS primary_like
        WHERE primary_like.user_id = ${primaryUserId}
          AND primary_like.resource_id = duplicate_like.resource_id
      )
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_likes
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;

  await transaction.$queryRaw`
    UPDATE project_activity_parents
    SET closed_by_id = ${primaryUserId}
    WHERE closed_by_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE project_activity_children
    SET assignee_user_id = ${primaryUserId}
    WHERE assignee_user_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE project_activity_children
    SET returned_by_id = ${primaryUserId}
    WHERE returned_by_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE activity_events
    SET actor_user_id = ${primaryUserId}
    WHERE actor_user_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE activity_attachments
    SET uploaded_by_id = ${primaryUserId}
    WHERE uploaded_by_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE activity_attachments
    SET deleted_by_id = ${primaryUserId}
    WHERE deleted_by_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE notifications
    SET recipient_user_id = ${primaryUserId}
    WHERE recipient_user_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE notifications
    SET created_by_id = ${primaryUserId}
    WHERE created_by_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE tasks
    SET creator_id = ${primaryUserId}
    WHERE creator_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE observability_events
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_migration_runs
    SET operator_id = ${primaryUserId}
    WHERE operator_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resources
    SET created_by_id = ${primaryUserId}
    WHERE created_by_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resources
    SET owner_id = ${primaryUserId}
    WHERE owner_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_review_requests
    SET requester_id = ${primaryUserId}
    WHERE requester_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_review_requests
    SET reviewer_id = ${primaryUserId}
    WHERE reviewer_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_update_logs
    SET actor_id = ${primaryUserId}
    WHERE actor_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_update_logs
    SET reviewer_id = ${primaryUserId}
    WHERE reviewer_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_comments
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_favorite_tags
    SET user_id = ${primaryUserId}
    WHERE user_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_memberships
    SET updated_by_id = ${primaryUserId}
    WHERE updated_by_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_role_audits
    SET subject_user_id = ${primaryUserId}
    WHERE subject_user_id = ${duplicateUserId}
  `;
  await transaction.$queryRaw`
    UPDATE ai_resource_role_audits
    SET actor_id = ${primaryUserId}
    WHERE actor_id = ${duplicateUserId}
  `;

  await transaction.$queryRaw`
    UPDATE users
    SET status = 'disabled',
        platform_role = 'user',
        role = 'user',
        external_source = 'merged',
        external_id = ${duplicateUserId},
        external_id_authing = NULL,
        unionid = NULL,
        dingtalk_user_id = NULL,
        email = CASE
          WHEN ${preferredEmail}::text IS NOT NULL
            AND lower(email) = lower(${preferredEmail}::text)
          THEN NULL
          ELSE email
        END
    WHERE id = ${duplicateUserId}
  `;
  return true;
}

export async function mergeUsersIntoPrimary(
  transaction: DatabaseClient,
  primaryUserId: string,
  duplicateUserIds: string[],
  options?: { preferredEmail?: string | null },
) {
  const mergedUserIds: string[] = [];
  for (const duplicateUserId of [...new Set(duplicateUserIds)]) {
    if (duplicateUserId === primaryUserId) continue;
    const merged = await mergeOneUser(
      transaction,
      primaryUserId,
      duplicateUserId,
      options?.preferredEmail ?? null,
    );
    if (merged) mergedUserIds.push(duplicateUserId);
  }
  return mergedUserIds;
}
