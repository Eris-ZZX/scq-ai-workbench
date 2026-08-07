import { randomUUID } from 'node:crypto';
import { DUMMY_HASH } from '@/lib/db/auth';
import { db } from '@/lib/database';
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
  `;
}

export async function upsertAuthingUser(identity: AuthingClaims) {
  const identityKey = authingIdentityKey(identity);

  return db.$transaction(async (transaction) => {
    const knownIdentity = await transaction.$queryRaw<IdentityRow[]>`
      SELECT user_id
      FROM user_identities
      WHERE provider = 'authing'
        AND issuer = ${identity.issuer}
        AND subject = ${identity.subject}
      LIMIT 1
    `;

    let user = knownIdentity[0]
      ? await findUserById(transaction, knownIdentity[0].user_id)
      : null;

    if (knownIdentity[0] && !user) {
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
      const unionidUsers = await findUsersByUnionid(transaction, identity.unionid);
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
          unionid: identity.unionid,
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
          unionid = COALESCE(${identity.unionid}::text, unionid),
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
