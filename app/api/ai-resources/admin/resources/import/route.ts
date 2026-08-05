import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { db } from '@/lib/database';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import {
  AI_RESOURCE_AUDIT_ACTIONS,
  appendAiResourceAuditLog,
  getAuditRequestContext,
} from '@/modules/ai-resources/audit';
import { requireAiResourceRoleApi } from '@/modules/ai-resources/guards';
import { toDbResourceData } from '@/modules/ai-resources/resource-data';
import { listActiveAiResourceUsers } from '@/modules/ai-resources/users';
import { resourcePayloadSchema } from '@/modules/ai-resources/validation';

/** Rows per DB transaction. Large imports are queued as sequential batches (no user-facing caps). */
const IMPORT_BATCH_SIZE = 40;

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAiResourceRoleApi('admin');
    const auditContext = getAuditRequestContext(request);

    const formData = await request.formData().catch(() => null);
    const file = formData?.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '请上传 Excel 文件。' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let parsedRows: Array<z.infer<typeof resourcePayloadSchema>>;
    let ownerFallbackCount = 0;
    try {
      const rawRows = parseExcelRows(buffer);
      if (!rawRows.length) {
        return NextResponse.json({ error: '没有解析到可导入的资源。' }, { status: 400 });
      }
      const activeUsers = await listActiveAiResourceUsers();
      const usersByName = new Map(activeUsers.map((user) => [user.username, user]));
      const fallbackOwner = activeUsers.find((user) => user.id === actor.userId);
      if (!fallbackOwner) {
        return NextResponse.json({ error: '当前操作用户不可作为负责人。' }, { status: 400 });
      }

      parsedRows = rawRows.map((row, index) => {
        const ownerInput = String(row.ownerName ?? row['负责人'] ?? '').trim();
        const owner = usersByName.get(ownerInput) ?? fallbackOwner;
        if (!usersByName.has(ownerInput)) ownerFallbackCount += 1;
        const parsed = resourcePayloadSchema.safeParse(normalizeImportRow(row, owner));
        if (!parsed.success) {
          throw new ImportError(`第${index + 1} 行：${formatZodError(parsed.error)}`);
        }
        return parsed.data;
      });
    } catch (error) {
      if (error instanceof ImportError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const count = await importRowsInBatches(parsedRows, actor.userId, actor.username, auditContext);

    return NextResponse.json({
      count,
      batches: Math.ceil(count / IMPORT_BATCH_SIZE),
      batchSize: IMPORT_BATCH_SIZE,
      ownerFallbackCount,
    });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

async function importRowsInBatches(
  rows: Array<z.infer<typeof resourcePayloadSchema>>,
  userId: string,
  username: string,
  auditContext: ReturnType<typeof getAuditRequestContext>,
) {
  let imported = 0;

  for (let offset = 0; offset < rows.length; offset += IMPORT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + IMPORT_BATCH_SIZE);

    await db.$transaction(
      async (tx) => {
        const created = await tx.aiResource.createManyAndReturn({
          data: batch.map((row) => ({
            ...toDbResourceData(row),
            createdById: userId,
          })),
        });

        await tx.aiResourceUpdateLog.createMany({
          data: created.map((resource, index) => {
            const row = batch[index]!;
            return {
              resourceId: resource.id,
              actorId: userId,
              reviewerId: userId,
              action: 'CREATE',
              result: 'APPROVED',
              updateSummary: '管理员批量导入',
              changedFields: Object.keys(row).join(','),
            };
          }),
        });
        await appendAiResourceAuditLog({
          actorId: userId,
          actorUsername: username,
          action: AI_RESOURCE_AUDIT_ACTIONS.RESOURCE_IMPORT,
          targetType: 'IMPORT',
          result: 'SUCCESS',
          after: {
            batchSize: batch.length,
            offset,
            resources: created.map((resource) => ({
              id: resource.id,
              name: resource.name,
              ownerId: resource.ownerId,
              ownerName: resource.ownerName,
            })),
          },
          ...auditContext,
        }, tx);
      },
      {
        maxWait: 15_000,
        timeout: 120_000,
      },
    );

    imported += batch.length;
    // Yield between batches so other requests can progress (in-process queue).
    await yieldEventLoop();
  }

  return imported;
}

function yieldEventLoop() {
  return new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

function parseExcelRows(buffer: Buffer): Array<Record<string, unknown>> {
  if (buffer.length < 8) throw new ImportError('Excel 文件内容为空。');

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new ImportError('Excel 文件格式不正确。');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new ImportError('Excel 文件中没有工作表。');
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new ImportError('Excel 工作表为空。');

  const rawGrid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
  const dataRows = rawGrid.filter(
    (row: unknown[]): row is string[] =>
      Array.isArray(row) && row.some((cell) => cell != null && String(cell).trim()),
  );
  if (dataRows.length < 2) throw new ImportError('Excel 工作表中至少需要表头行和一行数据。');

  const [headerRow, ...values] = dataRows;
  if (!headerRow) throw new ImportError('Excel 工作表中至少需要表头行和一行数据。');
  const headers = headerRow;
  const rawRows = values.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [String(header ?? '').trim(), String(row[index] ?? '').trim()]),
    ),
  );
  if (!rawRows.length) throw new ImportError('Excel 工作表中没有数据行。');

  return rawRows;
}

function normalizeImportRow(
  row: Record<string, unknown>,
  owner: { id: string; username: string },
) {
  return {
    name: row.name ?? row['资源名称'],
    type: normalizeType(row.type ?? row['资源类型']),
    summary: row.summary ?? row['面向用户/使用说明'] ?? row['使用说明'] ?? row['简介'],
    tags: normalizeList(row.tags ?? row['适用小组'] ?? row['标签']),
    ownerId: owner.id,
    ownerName: owner.username,
    visibilityScope: 'ALL' as const,
    visibleDeptIds: [],
    visibleUserIds: [],
    status: 'PUBLISHED' as const,
    resourceUrl: normalizeResourceUrls(row.resourceUrl ?? row.resourceUrls ?? row['存储路径/链接']),
    content: row.content ?? row['实现方法简述'] ?? row['正文'],
    attachments: normalizeAttachments(row.attachments ?? row['附件']),
    extension: null,
    extractedText: row.extractedText ?? row.content ?? row['实现方法简述'] ?? row['正文'],
  };
}

function normalizeType(value: unknown) {
  const text = String(value ?? '').trim();
  const byLabel: Record<string, string> = {
    应用: 'APP',
    HTML网页: 'WEB_PAGE',
    'HTML 网页': 'WEB_PAGE',
    网页: 'WEB_PAGE',
    案例: 'CASE',
    规范文档: 'STANDARD_DOC',
    工作流: 'WORKFLOW',
    其他: 'OTHER',
  };
  return byLabel[text] ?? text.toUpperCase();
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value ?? '')
    .split(/[,;\uff0c\uff1b]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeResourceUrls(value: unknown) {
  const values = normalizeList(value);
  if (!values.length) return null;
  return JSON.stringify(values);
}

function normalizeAttachments(value: unknown) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

class ImportError extends Error {}
