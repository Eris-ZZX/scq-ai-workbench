import { randomUUID } from 'node:crypto';
import { DUMMY_HASH } from '@/lib/db/auth';
import { db } from '@/lib/database';
import { findDingTalkDirectoryUsersByJobNumber } from '@/lib/dingtalk/organization';
import { resolveDingTalkIdentityByMobile } from '@/lib/dingtalk/users';
import { authingIdentityKey, type AuthingClaims } from './authing.claims';

type IdentityRow = {
  user_id: string;
  subject?: string;
};

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

async function findUsersByUsername(transaction: typeof db, username: string) {
  return transaction.$queryRaw<UserRow[]>`
    SELECT id, username, display_name, email, avatar, platform_role, role, status
    FROM users
    WHERE username = ${username}
  `;
}

async function findUsersByEmail(transaction: typeof db, email: string | null) {
  if (!email) return [];
  return transaction.$queryRaw<UserRow[]>`
    SELECT id, username, display_name, email, avatar, platform_role, role, status
    FROM users
    WHERE lower(email) = lower(${email})
  `;
}

async function findUsersByUnionid(transaction: typeof db, unionid: string | null) {
  if (!unionid) return [];
  return transaction.$queryRaw<UserRow[]>`
    SELECT id, username, display_name, email, avatar, platform_role, role, status
    FROM users
    WHERE unionid = ${unionid}
       OR (external_source = 'dingtalk' AND external_id = ${unionid})
  `;
}

async function resolveDingTalkIdentity(identity: AuthingClaims) {
  if (identity.unionid) {
    return { unionid: identity.unionid, dingtalkUserId: null };
  }

  if (identity.phoneNumber) {
    const mobileIdentity = await resolveDingTalkIdentityByMobile(identity.phoneNumber);
    if (
      mobileIdentity &&
      (!identity.employeeNumber ||
        !mobileIdentity.jobNumber ||
        mobileIdentity.jobNumber === identity.employeeNumber)
    ) {
      return {
        unionid: mobileIdentity.unionid,
        dingtalkUserId: mobileIdentity.userid,
      };
    }
  }

  if (!identity.employeeNumber) return null;

  const matches = await findDingTalkDirectoryUsersByJobNumber(identity.employeeNumber);
  if (matches.length > 1) {
    throw new ExternalIdentityError(
      'conflict',
      `钉钉工号 ${identity.employeeNumber} 匹配到多个账号`,
    );
  }

  const match = matches[0];
  const unionid = match?.unionid ?? match?.unionId;
  if (!match || !unionid || !match.userid) {
    throw new ExternalIdentityError(
      'missing',
      `钉钉通讯录中未找到工号 ${identity.employeeNumber} 的完整身份`,
    );
  }
  return { unionid: String(unionid), dingtalkUserId: String(match.userid) };
}

export async function upsertAuthingUser(identity: AuthingClaims) {
  const identityKey = authingIdentityKey(identity);
  const knownIdentity = await db.$queryRaw<{
    user_id: string;
    unionid: string | null;
    dingtalk_user_id: string | null;
  }[]>`
    SELECT ui.user_id, u.unionid, u.dingtalk_user_id
    FROM user_identities AS ui
    JOIN users AS u ON u.id = ui.user_id
    WHERE ui.provider = 'authing'
      AND ui.issuer = ${identity.issuer}
      AND ui.subject = ${identity.subject}
    LIMIT 1
  `;
  const dingTalkIdentity = knownIdentity[0]
    ? null
    : await resolveDingTalkIdentity(identity);
  const resolvedUnionid = identity.unionid ?? dingTalkIdentity?.unionid ?? null;

  return db.$transaction(async (transaction) => {
    const knownIdentityRows = await transaction.$queryRaw<IdentityRow[]>`
      SELECT user_id
      FROM user_identities
      WHERE provider = 'authing'
        AND issuer = ${identity.issuer}
        AND subject = ${identity.subject}
      LIMIT 1
    `;

    let user = knownIdentityRows[0]
      ? await findUserById(transaction, knownIdentityRows[0].user_id)
      : null;

    if (knownIdentityRows[0] && !user) {
      throw new ExternalIdentityError('missing', 'Authing 身份绑定的本地用户不存在');
    }

    if (!user) {
      const usernameUsers = await findUsersByUsername(transaction, identity.username);
      if (usernameUsers.length > 1) {
        throw new ExternalIdentityError('conflict', 'Authing username 匹配到多个本地账号');
      }
      user = usernameUsers[0] ?? null;
    }

    if (!user) {
      // 钉钉来源的本地用户以 unionid 为衔接键，优先于 email 匹配
      const unionidUsers = await findUsersByUnionid(transaction, resolvedUnionid);
      if (unionidUsers.length > 1) {
        throw new ExternalIdentityError('conflict', 'Authing unionid 匹配到多个本地账号');
      }
      user = unionidUsers[0] ?? null;
    }

    if (!user) {
      const emailUsers = await findUsersByEmail(transaction, identity.email);
      if (emailUsers.length > 1) {
        throw new ExternalIdentityError('conflict', 'Authing email 匹配到多个本地账号');
      }
      user = emailUsers[0] ?? null;
    }

    if (!user && !resolvedUnionid) {
      throw new ExternalIdentityError(
        'missing',
        identity.employeeNumber
          ? `未能为 Authing 工号 ${identity.employeeNumber} 找到钉钉身份`
          : 'Authing 未返回 emp_no，无法绑定钉钉身份',
      );
    }

    if (!user) {
      const created = await transaction.user.create({
        data: {
          id: randomUUID(),
          username: identity.username,
          displayName: identity.name,
          passwordHash: DUMMY_HASH,
          email: identity.email,
          avatar: identity.avatar,
          platformRole: 'user',
          role: 'user',
          status: 'active',
          externalSource: 'authing',
          externalId: identityKey,
          dingtalkUserId: dingTalkIdentity?.dingtalkUserId ?? null,
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
    }

    if (user.status !== 'active') {
      throw new ExternalIdentityError('disabled', '本地账号已被禁用，请联系管理员');
    }

    const identityConflicts = await transaction.$queryRaw<UserRow[]>`
      SELECT id, username, display_name, email, avatar, platform_role, role, status
      FROM users
      WHERE id <> ${user.id}
        AND (
          (${resolvedUnionid}::text IS NOT NULL AND unionid = ${resolvedUnionid}::text)
          OR (
            ${dingTalkIdentity?.dingtalkUserId ?? null}::text IS NOT NULL
            AND dingtalk_user_id = ${dingTalkIdentity?.dingtalkUserId ?? null}::text
          )
        )
      LIMIT 2
    `;
    if (identityConflicts.length > 0) {
      throw new ExternalIdentityError('conflict', '钉钉身份已绑定其他本地账号');
    }

    const existingUserIdentity = await transaction.$queryRaw<IdentityRow[]>`
      SELECT user_id, subject
      FROM user_identities
      WHERE provider = 'authing'
        AND issuer = ${identity.issuer}
        AND user_id = ${user.id}
        AND subject <> ${identity.subject}
      LIMIT 1
    `;
    if (existingUserIdentity[0]) {
      throw new ExternalIdentityError('conflict', '本地账号已绑定其他 Authing 身份');
    }

    await transaction.$queryRaw`
      UPDATE users
      SET display_name = COALESCE(${identity.name}::text, display_name),
          email = CASE
            WHEN ${identity.email}::text IS NOT NULL
              AND (email IS NULL OR lower(email) = lower(${identity.email}::text))
            THEN ${identity.email}::text
            ELSE email
          END,
          avatar = COALESCE(${identity.avatar}::text, avatar),
          unionid = COALESCE(${resolvedUnionid}::text, unionid),
          dingtalk_user_id = COALESCE(${dingTalkIdentity?.dingtalkUserId ?? null}::text, dingtalk_user_id),
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
    };
  });
}
