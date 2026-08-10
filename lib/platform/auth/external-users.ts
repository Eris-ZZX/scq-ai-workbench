import { randomUUID } from 'node:crypto';
import { DUMMY_HASH } from '@/lib/db/auth';
import { db } from '@/lib/database';
import { resolveDingTalkIdentityByUserId } from '@/lib/dingtalk/users';
import {
  findUserMergeCandidates,
  mergeUsersIntoPrimary,
  type UserMergeCandidate,
} from './user-merge';
import { authingIdentityKey, type AuthingClaims } from './authing.claims';

type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  avatar: string | null;
  platform_role: string;
  role: string;
  status: string;
};

export class ExternalIdentityError extends Error {
  readonly code: 'disabled' | 'conflict' | 'missing';

  constructor(
    code: 'disabled' | 'conflict' | 'missing',
    message: string,
  ) {
    super(message);
    this.name = 'ExternalIdentityError';
    this.code = code;
  }
}

async function findUserById(transaction: typeof db, userId: string) {
  const rows = await transaction.$queryRaw<UserRow[]>`
    SELECT id, username, display_name, email, avatar, platform_role, role, status
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function resolveDingTalkIdentity(identity: AuthingClaims) {
  const userId = identity.username.trim();
  if (
    identity.employeeNumber &&
    identity.employeeNumber !== userId
  ) {
    throw new ExternalIdentityError(
      'conflict',
      `Authing username ${userId} 与 emp_no ${identity.employeeNumber} 不一致`,
    );
  }

  const resolved = await resolveDingTalkIdentityByUserId(userId);
  if (!resolved) {
    throw new ExternalIdentityError(
      'missing',
      `钉钉用户详情接口未找到 userid ${userId} 或未返回 unionid`,
    );
  }

  if (
    identity.employeeNumber &&
    resolved.jobNumber &&
    resolved.jobNumber !== identity.employeeNumber
  ) {
    throw new ExternalIdentityError(
      'conflict',
      `钉钉 userid ${userId} 的工号 ${resolved.jobNumber} 与 Authing emp_no ${identity.employeeNumber} 不一致`,
    );
  }

  return resolved;
}

function selectPrimaryCandidate(candidates: UserMergeCandidate[]) {
  return candidates.find((candidate) => candidate.has_authing_identity)
    ?? candidates.find((candidate) => candidate.username_match)
    ?? candidates.find((candidate) => candidate.unionid_match || candidate.userid_match)
    ?? candidates.find((candidate) => candidate.email_match)
    ?? candidates[0]
    ?? null;
}

export async function upsertAuthingUser(identity: AuthingClaims) {
  const identityKey = authingIdentityKey(identity);
  const dingTalkIdentity = await resolveDingTalkIdentity(identity);
  const resolvedUnionid = dingTalkIdentity.unionid;
  const resolvedDingTalkUserId = identity.username.trim();

  return db.$transaction(async (transaction) => {
    const candidates = await findUserMergeCandidates(transaction, {
      issuer: identity.issuer,
      subject: identity.subject,
      authingExternalId: identityKey,
      externalId: identity.externalId,
      username: resolvedDingTalkUserId,
      email: identity.email,
      unionid: resolvedUnionid,
      dingtalkUserId: resolvedDingTalkUserId,
    });
    const primaryCandidate = selectPrimaryCandidate(candidates);
    let user = primaryCandidate
      ? await findUserById(transaction, primaryCandidate.id)
      : null;
    let mergedUserIds: string[] = [];

    if (user?.status !== 'active' && user) {
      throw new ExternalIdentityError('disabled', '本地账号已被禁用，请联系管理员');
    }

    if (!user) {
      const created = await transaction.user.create({
        data: {
          id: randomUUID(),
          username: resolvedDingTalkUserId,
          displayName: identity.name,
          passwordHash: DUMMY_HASH,
          email: identity.email,
          avatar: identity.avatar,
          platformRole: 'user',
          role: 'user',
          status: 'active',
          externalSource: 'authing',
          externalId: identityKey,
          dingtalkUserId: resolvedDingTalkUserId,
          unionid: resolvedUnionid,
          phoneNumber: identity.phoneNumber,
          phoneNumberVerified: identity.phoneNumberVerified,
          emailVerified: identity.emailVerified,
          address: identity.address,
          birthdate: identity.birthdate,
          gender: identity.gender,
          locale: identity.locale,
          nickname: identity.nickname,
          preferredUsername: identity.preferredUsername,
          profile: identity.profile,
          website: identity.website,
          zoneinfo: identity.zoneinfo,
          externalIdAuthing: identity.externalId,
          extendedFields: identity.extendedFields,
          tenantId: identity.tenantId,
          userpoolId: identity.userpoolId,
          roles: identity.roles,
        },
      });
      user = {
        id: String(created.id),
        username: String(created.username),
        display_name: identity.name,
        email: identity.email,
        avatar: identity.avatar,
        platform_role: 'user',
        role: 'user',
        status: 'active',
      };
    } else {
      mergedUserIds = await mergeUsersIntoPrimary(
        transaction,
        user.id,
        candidates.filter((candidate) => candidate.id !== user?.id).map((candidate) => candidate.id),
        { preferredEmail: identity.email },
      );
    }

    await transaction.$queryRaw`
      DELETE FROM user_identities
      WHERE user_id = ${user.id}
        AND provider = 'authing'
        AND issuer = ${identity.issuer}
        AND subject <> ${identity.subject}
    `;

    await transaction.$queryRaw`
      UPDATE users
      SET username = ${resolvedDingTalkUserId},
          display_name = COALESCE(${identity.name}::text, display_name),
          email = COALESCE(${identity.email}::text, email),
          avatar = COALESCE(${identity.avatar}::text, avatar),
          external_source = 'authing',
          external_id = ${identityKey},
          unionid = ${resolvedUnionid},
          dingtalk_user_id = ${resolvedDingTalkUserId},
          phone_number = COALESCE(${identity.phoneNumber}::text, phone_number),
          phone_number_verified = COALESCE(${identity.phoneNumberVerified}, phone_number_verified),
          email_verified = COALESCE(${identity.emailVerified}, email_verified),
          address = COALESCE(${identity.address}::text, address),
          birthdate = COALESCE(${identity.birthdate}::text, birthdate),
          gender = COALESCE(${identity.gender}::text, gender),
          locale = COALESCE(${identity.locale}::text, locale),
          nickname = COALESCE(${identity.nickname}::text, nickname),
          preferred_username = COALESCE(${identity.preferredUsername}::text, preferred_username),
          profile = COALESCE(${identity.profile}::text, profile),
          website = COALESCE(${identity.website}::text, website),
          zoneinfo = COALESCE(${identity.zoneinfo}::text, zoneinfo),
          external_id_authing = COALESCE(${identity.externalId}::text, external_id_authing),
          extended_fields = COALESCE(${identity.extendedFields}::text, extended_fields),
          tenant_id = COALESCE(${identity.tenantId}::text, tenant_id),
          userpool_id = COALESCE(${identity.userpoolId}::text, userpool_id),
          roles = COALESCE(${identity.roles}::text, roles)
      WHERE id = ${user.id}
    `;

    await transaction.$queryRaw`
      INSERT INTO user_identities (
        id, user_id, provider, issuer, subject, username, display_name,
        email, avatar, last_login_at, last_sync_at, created_at, updated_at
      )
      VALUES (
        ${randomUUID()}, ${user.id}, 'authing', ${identity.issuer}, ${identity.subject},
        ${identity.username}, ${identity.name}, ${identity.email}, ${identity.avatar},
        now(), now(), now(), now()
      )
      ON CONFLICT (provider, issuer, subject)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        avatar = EXCLUDED.avatar,
        last_login_at = now(),
        last_sync_at = now(),
        updated_at = now()
    `;

    const refreshed = await findUserById(transaction, user.id);
    if (!refreshed) {
      throw new ExternalIdentityError('missing', '本地用户不存在');
    }

    return {
      id: refreshed.id,
      username: refreshed.username,
      platformRole: refreshed.platform_role,
      role: refreshed.role,
      status: refreshed.status,
      displayName: refreshed.display_name,
      mergedUserIds,
    };
  });
}
