'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Download, FileSpreadsheet, FileUp } from 'lucide-react';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

export function AdminImportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function importResources(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage(null);

    const body = new FormData();
    body.append('file', file);

    const response = await fetch('/api/ai-resources/admin/resources/import', {
      method: 'POST',
      body,
    });
    const payload = await response.json().catch(() => null);
    setBusy(false);

    if (!response.ok) {
      setMessage(getErrorMessage(payload, '批量导入失败。'));
      return;
    }

    setMessage(
      `已导入 ${payload?.count ?? 0} 条资源${payload?.batches > 1 ? `（分 ${payload.batches} 批）` : ''}。`,
    );
    router.refresh();
  }

  async function downloadTemplate() {
    try {
      const response = await fetch('/api/ai-resources/admin/resources/template');
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        setMessage(err?.error || '下载失败。');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'AI资源导入模板.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 200);
    } catch {
      setMessage('下载失败。');
    }
  }

  return (
    <form className="admin-import" onSubmit={importResources}>
      <header className="admin-function-head">
        <div>
          <h2>批量导入</h2>
          <p className="subtle">
            支持 Excel (.xlsx / .xls) 文件，第一行为表头，字段可使用中文列名。大文件会在服务端自动分批排队写入，不限制行数。
            点击“下载模板”获取带示例的导入模板。
          </p>
        </div>
        <div className="meta">
          <button type="button" className="button" onClick={downloadTemplate}>
            <Download size={16} />
            下载模板
          </button>
          <label className="file-picker compact">
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
            />
            <FileUp size={16} />
            选择文件
          </label>
        </div>
      </header>

      {file ? (
        <div className="file-selected">
          <FileSpreadsheet size={18} />
          <span>{file.name}</span>
        </div>
      ) : (
        <div className="empty-hint">请选择要导入的 Excel 文件</div>
      )}

      <div className="meta">
        <button className="button primary" type="submit" disabled={busy || !file}>
          {busy ? '分批导入中，请稍候…' : '开始导入'}
        </button>
        {message ? (
          <span className={message.includes('失败') ? 'badge danger' : 'badge primary'}>{message}</span>
        ) : null}
      </div>
    </form>
  );
}
