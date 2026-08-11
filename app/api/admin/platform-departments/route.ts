import { NextRequest, NextResponse } from 'next/server';
import { db, isForeignKeyViolation, isUniqueViolation } from '@/lib/database';
import { requireSystemAdminApi } from '@/platform/permissions/system-admin';

const MAX_IMPORT_SIZE = 1000;

type DepartmentInput = {
  id?: unknown;
  name?: unknown;
  parentId?: unknown;
};

type NormalizedDepartment = {
  id: string;
  name: string;
  parentId: string | null;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDepartment(input: DepartmentInput) {
  const id = clean(input.id);
  const name = clean(input.name);
  const parentId = input.parentId == null || clean(input.parentId) === ''
    ? null
    : clean(input.parentId);

  if (!id) return { error: '组织 ID 不能为空。' } as const;
  if (id.length > 100) return { error: '组织 ID 不能超过 100 个字符。' } as const;
  if (!name) return { error: '组织名称不能为空。' } as const;
  if (name.length > 200) return { error: '组织名称不能超过 200 个字符。' } as const;
  if (parentId === id) return { error: '上级组织不能是组织自身。' } as const;

  return { value: { id, name, parentId } } as const;
}

async function assertParentExists(parentId: string | null, currentId?: string) {
  if (!parentId || parentId === currentId) return null;
  const parent = await db.dingTalkDepartment.findUnique({
    where: { id: parentId },
    select: { id: true },
  });
  return parent ? null : '上级组织 ID 不存在，请先导入或创建上级组织。';
}

async function importDepartments(input: unknown) {
  const rawItems = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as { departments?: unknown }).departments)
      ? (input as { departments: unknown[] }).departments
      : null;

  if (!rawItems) return { error: 'JSON 须为数组，或包含 departments 数组。' } as const;
  if (rawItems.length === 0) return { error: '导入列表不能为空。' } as const;
  if (rawItems.length > MAX_IMPORT_SIZE) {
    return { error: `单次最多导入 ${MAX_IMPORT_SIZE} 条组织映射。` } as const;
  }

  const normalized: NormalizedDepartment[] = [];
  const ids = new Set<string>();
  for (const item of rawItems) {
    const result = normalizeDepartment((item ?? {}) as DepartmentInput);
    if ('error' in result) return result;
    if (ids.has(result.value.id)) {
      return { error: `JSON 中存在重复组织 ID：${result.value.id}。` } as const;
    }
    ids.add(result.value.id);
    normalized.push(result.value);
  }

  const parentIds = Array.from(new Set(
    normalized
      .map((item) => item.parentId)
      .filter((parentId): parentId is string => Boolean(parentId)),
  ));
  const existingParents = parentIds.length
    ? await db.dingTalkDepartment.findMany({
        where: { id: { in: parentIds } },
        select: { id: true },
      })
    : [];
  const availableIds = new Set([
    ...ids,
    ...existingParents.map((item) => item.id),
  ]);
  const missingParent = normalized.find((item) => item.parentId && !availableIds.has(item.parentId));
  if (missingParent?.parentId) {
    return { error: `组织 ${missingParent.id} 的上级组织 ID 不存在：${missingParent.parentId}。` } as const;
  }

  await db.$transaction(async (tx) => {
    for (const item of normalized) {
      await tx.dingTalkDepartment.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          name: item.name,
          parentId: item.parentId,
          syncAt: new Date(),
        },
        update: {
          name: item.name,
          parentId: item.parentId,
          syncAt: new Date(),
        },
      });
    }
  });

  return { value: { count: normalized.length } } as const;
}

export async function GET(request: NextRequest) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const query = clean(request.nextUrl.searchParams.get('q'));
  const departments = await db.dingTalkDepartment.findMany({
    where: query
      ? {
          OR: [
            { id: { contains: query } },
            { name: { contains: query } },
            { parentId: { contains: query } },
          ],
        }
      : undefined,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: 2000,
  });

  return NextResponse.json({ departments });
}

export async function POST(request: Request) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null) as DepartmentInput & { departments?: unknown } | unknown;
  if (
    body &&
    typeof body === 'object' &&
    Array.isArray((body as { departments?: unknown }).departments)
  ) {
    try {
      const result = await importDepartments(body);
      if ('error' in result) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result.value, { status: 200 });
    } catch (error) {
      console.error('[admin/platform-departments:import]', error);
      return NextResponse.json({ error: '组织映射导入失败。' }, { status: 500 });
    }
  }

  const result = normalizeDepartment((body ?? {}) as DepartmentInput);
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  const parentError = await assertParentExists(result.value.parentId);
  if (parentError) return NextResponse.json({ error: parentError }, { status: 400 });

  try {
    const department = await db.dingTalkDepartment.create({
      data: { ...result.value, syncAt: new Date() },
    });
    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: '组织 ID 已存在。' }, { status: 409 });
    }
    console.error('[admin/platform-departments:POST]', error);
    return NextResponse.json({ error: '创建组织映射失败。' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null) as DepartmentInput | null;
  const id = clean(body?.id);
  if (!id) return NextResponse.json({ error: '缺少组织 ID。' }, { status: 400 });

  const result = normalizeDepartment(body ?? {});
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  if (result.value.id !== id) {
    return NextResponse.json({ error: '不支持修改组织 ID。' }, { status: 400 });
  }
  const parentError = await assertParentExists(result.value.parentId, id);
  if (parentError) return NextResponse.json({ error: parentError }, { status: 400 });

  try {
    const department = await db.dingTalkDepartment.update({
      where: { id },
      data: {
        name: result.value.name,
        parentId: result.value.parentId,
        syncAt: new Date(),
      },
    });
    return NextResponse.json({ department });
  } catch (error) {
    console.error('[admin/platform-departments:PATCH]', error);
    return NextResponse.json({ error: '更新组织映射失败。' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSystemAdminApi();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = clean(request.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: '缺少组织 ID。' }, { status: 400 });

  const [userCount, childCount] = await Promise.all([
    db.userDingTalkDepartment.count({ where: { departmentId: id } }),
    db.dingTalkDepartment.count({ where: { parentId: id } }),
  ]);
  if (userCount > 0) {
    return NextResponse.json({ error: '该组织仍绑定用户，不能删除。' }, { status: 409 });
  }
  if (childCount > 0) {
    return NextResponse.json({ error: '该组织仍有下级组织，不能删除。' }, { status: 409 });
  }

  try {
    await db.dingTalkDepartment.delete({ where: { id } });
    return NextResponse.json({ id });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return NextResponse.json({ error: '该组织仍被其他数据引用，不能删除。' }, { status: 409 });
    }
    console.error('[admin/platform-departments:DELETE]', error);
    return NextResponse.json({ error: '删除组织映射失败。' }, { status: 500 });
  }
}
