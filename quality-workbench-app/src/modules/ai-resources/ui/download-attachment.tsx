'use client';

import { Download } from 'lucide-react';

type DownloadAttachmentProps = {
  name: string;
  url: string;
};

type SaveFilePicker = (options?: {
  suggestedName?: string;
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

function toDownloadUrl(url: string, name: string) {
  if (url.startsWith('/uploads/')) {
    const storedName = url.slice('/uploads/'.length);
    return `/api/ai-resources/files/${encodeURIComponent(storedName)}?name=${encodeURIComponent(name)}`;
  }
  if (url.startsWith('/api/files/')) {
    const storedName = url.slice('/api/files/'.length).split('?')[0] ?? '';
    return `/api/ai-resources/files/${storedName}?name=${encodeURIComponent(name)}`;
  }
  if (url.startsWith('/api/ai-resources/files/')) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}name=${encodeURIComponent(name)}`;
  }
  return url;
}

export function DownloadAttachment({ name, url }: DownloadAttachmentProps) {
  const downloadUrl = toDownloadUrl(url, name);

  async function download() {
    const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;

    if (!picker) {
      fallbackDownload();
      return;
    }

    try {
      const response = await fetch(downloadUrl, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('下载失败');
      const blob = await response.blob();
      const handle = await picker({ suggestedName: name });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      fallbackDownload();
    }
  }

  function fallbackDownload() {
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return (
    <button className="attachment-download" type="button" onClick={download} title={name}>
      <Download size={14} />
      <span>{name}</span>
    </button>
  );
}
