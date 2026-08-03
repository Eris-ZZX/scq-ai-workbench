import * as XLSX from 'xlsx';
import { aiResourceErrorResponse } from '@/modules/ai-resources/errors';
import { requireAiResourceRoleApi } from '@/modules/ai-resources/guards';

export async function GET() {
  try {
    await requireAiResourceRoleApi('admin');

    const headers = [
      '资源名称',
      '资源类型',
      '负责人',
      '适用小组',
      '存储路径/链接',
      '面向用户/使用说明',
      '实现方法简述',
    ];
    const example = [
      '部门 Prompt 模板库',
      'Prompt',
      '资源审批员',
      'NPQ,PQM',
      'https://example.com',
      '沉淀可复用业务 Prompt',
      '包含变量说明和示例输入输出',
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(() => ({ wch: 30 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '资源导入模板');

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const encoded = encodeURIComponent('AI资源导入模板.xlsx');

    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="AI-Resource-Template.xlsx"; filename*=UTF-8''${encoded}`,
      },
    });
  } catch (error) {
    return aiResourceErrorResponse(error);
  }
}
