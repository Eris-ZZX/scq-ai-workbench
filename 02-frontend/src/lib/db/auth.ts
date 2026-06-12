// lib/db/auth.ts — User Prisma 操作封装 (F2.S1)
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/** 返回给客户端的安全 User 字段（不含 passwordHash） */
const SAFE_USER_SELECT = {
  id: true, username: true, displayName: true,
  role: true, status: true, email: true,
  createdAt: true, updatedAt: true,
} as const;

type SafeUser = Pick<
  Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>,
  keyof typeof SAFE_USER_SELECT
>;

/** 创建用户（密码自动 bcrypt 哈希） */
export async function createUser(params: {
  username: string;
  password: string;
  displayName: string;
  email?: string;
}) {
  const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
  return prisma.user.create({
    data: {
      username: params.username,
      passwordHash,
      displayName: params.displayName,
      email: params.email ?? null,
    },
    select: SAFE_USER_SELECT,
  });
}

/** 按 username 查找用户（含 passwordHash，仅用于登录验证） */
export function findByUsername(username: string) {
  return prisma.user.findUnique({ where: { username } });
}

/** 🔧 Agent 2-#6: 按 id 查找安全用户（不含 passwordHash/internalSource 等内部字段） */
export async function findById(id: string): Promise<SafeUser | null> {
  return prisma.user.findUnique({
    where: { id },
    select: SAFE_USER_SELECT,
  });
}

/** 验证密码 */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
