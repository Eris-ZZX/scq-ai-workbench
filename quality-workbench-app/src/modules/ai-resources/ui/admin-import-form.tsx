'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Download, FileSpreadsheet, FileUp } from 'lucide-react';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

export function AdminImportForm() {
  const router = useRouter();
  const [content, setContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function importResources(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content) return;
    setBusy(true);
    setMessage(null);

    const response = await fetch('/api/ai-resources/admin/resources/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const payload = await response.json().catch(() => null);
    setBusy(false);

    if (!response.ok) {
      setMessage(getErrorMessage(payload, '批量导入失败。'));
      return;
    }

    setMessage(`已导入 ${payload?.count ?? 0} 条资源。`);
    router.refresh();
  }

  async function readFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    setContent(btoa(binary));
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
            支持 Excel (.xlsx / .xls) 文件，第一行为表头，字段可使用中文列名。点击“下载模板”获取带示例的导入模板。
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
              onChange={(event) => readFile(event.currentTarget.files?.[0])}
            />
            <FileUp size={16} />
            选择文件
          </label>
        </div>
      </header>

      {fileName ? (
        <div className="file-selected">
          <FileSpreadsheet size={18} />
          <span>{fileName}</span>
        </div>
      ) : (
        <div className="empty-hint">请选择要导入的 Excel 文件</div>
      )}

      <div className="meta">
        <button className="button primary" type="submit" disabled={busy || !content}>
          {busy ? '导入中...' : '开始导入'}
        </button>
        {message ? (
          <span className={message.includes('失败') ? 'badge danger' : 'badge primary'}>{message}</span>
        ) : null}
      </div>
    </form>
  );
}
