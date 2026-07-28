import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { formatZodError } from '@/modules/ai-resources/api-errors';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceRoleApi } from '@/modules/ai-resources/guards';
import { toDbResourceData } from '@/modules/ai-resources/resource-data';
import { resourcePayloadSchema } from '@/modules/ai-resources/validation';

const importSchema = z.object({
  content: z.string().trim().min(2, '导入内容不能为空。'),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAiResourceRoleApi('admin');

    const payload = importSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ error: formatZodError(payload.error) }, { status: 400 });
    }

    let parsedRows: Array<z.infer<typeof resourcePayloadSchema>>;
    try {
      const rawRows = parseExcelRows(payload.data.content);
      if (!rawRows.length) {
        return NextResponse.json({ error: '没有解析到可导入的资源。' }, { status: 400 });
      }

      parsedRows = rawRows.map((row, index) => {
        const parsed = resourcePayloadSchema.safeParse(normalizeImportRow(row));
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

    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const row of parsedRows) {
        const resource = await tx.aiResource.create({
          data: {
            ...toDbResourceData(row),
            createdById: actor.userId,
          },
        });
        await tx.aiResourceUpdateLog.create({
          data: {
            resourceId: resource.id,
            actorId: actor.userId,
            reviewerId: actor.userId,
            action: 'CREATE',
            result: 'APPROVED',
            updateSummary: '管理员批量导入',
            changedFields: Object.keys(row).join(','),
          },
        });
        created.push(resource);
      }
      return created;
    });

    return NextResponse.json({ count: result.length });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}

function parseExcelRows(content: string): Array<Record<string, unknown>> {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(content, 'base64');
  } catch {
    throw new ImportError('Excel 文件内容无法解码。');
  }
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

function normalizeImportRow(row: Record<string, unknown>) {
  return {
    name: row.name ?? row['资源名称'],
    type: normalizeType(row.type ?? row['资源类型']),
    summary: row.summary ?? row['面向用户/使用说明'] ?? row['使用说明'] ?? row['简介'],
    tags: normalizeList(row.tags ?? row['适用小组'] ?? row['标签']),
    ownerName: row.ownerName ?? row['负责人'],
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
