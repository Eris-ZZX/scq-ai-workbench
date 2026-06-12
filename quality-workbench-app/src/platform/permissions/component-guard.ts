// platform/permissions/component-guard.ts — 组件开关中间件 (F7.S2/S3)
import { prisma } from '@/lib/prisma';

/** 检查指定路径的组件是否启用（含依赖链检查） */
export async function isComponentEnabled(path: string): Promise<boolean> {
  const comp = await prisma.componentConfig.findUnique({
    where: { path },
    select: { enabled: true, dependsOnId: true },
  });
  if (!comp) return false; // 未注册 → 不可达
  if (!comp.enabled) return false;
  // 递归检查依赖
  if (comp.dependsOnId) {
    const parent = await prisma.componentConfig.findUnique({
      where: { id: comp.dependsOnId },
      select: { enabled: true },
    });
    if (!parent?.enabled) return false;
  }
  return true;
}

/** 获取当前启用的组件列表（含排序） */
export async function getEnabledComponents() {
  return prisma.componentConfig.findMany({
    where: { enabled: true },
    orderBy: { order: 'asc' },
  });
}
