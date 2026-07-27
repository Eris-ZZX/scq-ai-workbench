'use client';

import type { AiResource } from '@/generated/prisma/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, Paperclip, Plus, Send, Trash2 } from 'lucide-react';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import { parseJsonForDisplay } from '@/modules/ai-resources/json';

type ResourceFormProps = {
  resource?: AiResource;
  directUpdate?: boolean;
};

type ResourceAttachment = {
  name: string;
  url: string;
  size: number;
  type: string;
};

type ResourcePath = {
  id: string;
  value: string;
  label: string;
};

const resourceTypes: Array<[AiResourceType, string]> = [
  ['APP', '应用'],
  ['AGENT', 'Agent'],
  ['SKILL', 'Skill'],
  ['MCP', 'MCP'],
  ['WEB_PAGE', 'HTML 网页'],
  ['CASE', '案例'],
  ['PROMPT', 'Prompt'],
  ['STANDARD_DOC', '规范文档'],
  ['WORKFLOW', '工作流'],
  ['OTHER', '其他'],
];

const groupTags = ['NPQ', 'PQM', 'SQM', 'RAM', 'FAE', 'QCM', 'EMS', '部门'];

export function ResourceForm({ resource, directUpdate = false }: ResourceFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [attachments, setAttachments] = useState<ResourceAttachment[]>(() =>
    parseAttachments(resource?.attachments),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    name: resource?.name ?? '',
    type: (resource?.type ?? 'AGENT') as AiResourceType,
    summary: resource?.summary ?? '',
    groups: resource?.tags ? resource.tags.split(',').filter(Boolean) : [],
    ownerName: resource?.ownerName ?? '',
    resourceUrls: parseResourceUrls(resource?.resourceUrl),
    content: resource?.content ?? '',
    updateSummary: '',
  });

  const endpoint = resource
    ? directUpdate
      ? `/api/ai-resources/admin/resources/${resource.id}`
      : `/api/ai-resources/resources/${resource.id}/change-request`
    : '/api/ai-resources/resources/draft';
  const submitMethod = directUpdate ? 'PATCH' : 'POST';
  const title = resource ? (directUpdate ? '保存资源' : '提交修改审批') : '提交新资源审批';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setMessage(null);
    try {
      const uploadedAttachments = await uploadSelectedFiles();
      const response = await fetch(endpoint, {
        method: submitMethod,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          updateSummary: resource ? form.updateSummary : '首次上传',
          resource: {
            name: form.name,
            type: form.type,
            summary: form.summary,
            tags: form.groups,
            ownerName: form.ownerName,
            visibilityScope: 'ALL',
            resourceUrl: serializeResourceUrls(form.resourceUrls),
            content: form.content,
            attachments: uploadedAttachments,
            extension: null,
            extractedText: form.content,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        setMessage(getErrorMessage(error, '提交失败。'));
        return;
      }

      setMessage(directUpdate ? '资源已保存。' : '已提交审批。');
      router.push(directUpdate && resource ? `/ai-resources/${resource.id}` : '/ai-resources/review');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '附件上传失败。');
    } finally {
      setSubmitting(false);
    }
  }

  function update(
    key: 'name' | 'type' | 'summary' | 'ownerName' | 'content' | 'updateSummary',
    value: string,
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateResourceUrl(id: string, field: 'value' | 'label', fieldValue: string) {
    setForm((current) => ({
      ...current,
      resourceUrls: current.resourceUrls.map((item) =>
        item.id === id ? { ...item, [field]: fieldValue } : item,
      ),
    }));
  }

  function addResourceUrl() {
    setForm((current) => ({
      ...current,
      resourceUrls: [...current.resourceUrls, createPath('')],
    }));
  }

  function removeResourceUrl(id: string) {
    setForm((current) => {
      const next = current.resourceUrls.filter((item) => item.id !== id);
      return { ...current, resourceUrls: next.length ? next : [createPath('')] };
    });
  }

  function toggleGroup(group: string) {
    setForm((current) => {
      const groups = current.groups.includes(group)
        ? current.groups.filter((item) => item !== group)
        : [...current.groups, group];
      return { ...current, groups };
    });
  }

  async function uploadSelectedFiles() {
    if (!files.length) return attachments;

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await fetch('/api/ai-resources/uploads', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(getErrorMessage(error, '附件上传失败。'));
    }

    const payload = (await response.json()) as { attachments?: ResourceAttachment[] };
    const nextAttachments = [...attachments, ...(payload.attachments ?? [])];
    setAttachments(nextAttachments);
    setFiles([]);
    return nextAttachments;
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-grid">
        <div className="field">
          <label>资源名称</label>
          <input value={form.name} onChange={(event) => update('name', event.target.value)} required />
        </div>
        <div className="field">
          <label>资源类型</label>
          <select value={form.type} onChange={(event) => update('type', event.target.value)}>
            {resourceTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>负责人</label>
          <input value={form.ownerName} onChange={(event) => update('ownerName', event.target.value)} required />
        </div>
        <div className="field">
          <label>适用小组</label>
          <div className="multi-dropdown">
            <button
              type="button"
              className="multi-dropdown-trigger"
              onClick={() => setGroupOpen((open) => !open)}
              aria-expanded={groupOpen}
            >
              <span>{form.groups.length ? form.groups.join('、') : '请选择小组'}</span>
              <ChevronDown size={16} />
            </button>
            {groupOpen ? (
              <div className="multi-dropdown-menu">
                {groupTags.map((group) => (
                  <label className="multi-dropdown-option" key={group}>
                    <input
                      type="checkbox"
                      checked={form.groups.includes(group)}
                      onChange={() => toggleGroup(group)}
                    />
                    {group}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="field">
          <label>存储路径/链接</label>
          <div className="path-list-editor">
            {form.resourceUrls.map((item, index) => (
              <div className="path-row" key={item.id}>
                <input
                  value={item.value}
                  onChange={(event) => updateResourceUrl(item.id, 'value', event.target.value)}
                  placeholder="https://... 或共享盘路径"
                />
                <input
                  value={item.label}
                  onChange={(event) => updateResourceUrl(item.id, 'label', event.target.value)}
                  placeholder="显示名称（可选）"
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => removeResourceUrl(item.id)}
                  title={index === 0 ? '清空此路径' : '删除此路径'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button className="button" type="button" onClick={addResourceUrl}>
              <Plus size={16} />
              添加路径/链接
            </button>
          </div>
        </div>
      </div>
      <div className="field">
        <label>附件</label>
        <label className="file-picker">
          <input
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
          />
          <Paperclip size={16} />
          选择附件
        </label>
        {attachments.length || files.length ? (
          <div className="attachment-list">
            {attachments.map((attachment) => (
              <a href={attachment.url} download key={attachment.url} title={attachment.name}>
                {attachment.name}
              </a>
            ))}
            {files.map((file) => (
              <span key={`${file.name}-${file.size}`} title={file.name}>
                {file.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="field">
        <label>面向用户/使用说明</label>
        <textarea value={form.summary} onChange={(event) => update('summary', event.target.value)} required />
      </div>
      <div className="field">
        <label>实现方法简述</label>
        <textarea value={form.content} onChange={(event) => update('content', event.target.value)} required />
      </div>
      {resource ? (
        <div className="field">
          <label>{directUpdate ? '更新原因' : '修改原因'}</label>
          <textarea
            value={form.updateSummary}
            onChange={(event) => update('updateSummary', event.target.value)}
            required
            placeholder="说明本次修改的原因和内容"
          />
        </div>
      ) : null}
      <button className="button primary" type="submit" disabled={submitting}>
        <Send size={16} />
        {submitting ? '提交中...' : title}
      </button>
      {message ? <p className={message.includes('失败') ? 'badge danger' : 'badge primary'}>{message}</p> : null}
    </form>
  );
}

function createPath(value: string, label = ''): ResourcePath {
  return {
    id: crypto.randomUUID(),
    value,
    label,
  };
}

function parseResourceUrls(value?: string | null): ResourcePath[] {
  if (!value) return [createPath('')];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const paths = parsed
        .map((item) => {
          if (typeof item === 'string') return createPath(item);
          if (item && typeof item === 'object' && 'url' in item) {
            return createPath(String(item.url), String((item as Record<string, unknown>).label ?? ''));
          }
          return '';
        })
        .filter(Boolean)
        .filter((item): item is ResourcePath => !!item);
      return paths.length ? paths : [createPath('')];
    }
  } catch {
    // plain string
  }
  return [createPath(value)];
}

function serializeResourceUrls(paths: ResourcePath[]) {
  const values = paths
    .map((item) => {
      const url = item.value.trim();
      if (!url) return null;
      const label = (item.label ?? '').trim();
      return label ? { url, label } : { url };
    })
    .filter(Boolean);
  if (!values.length) return '';
  return JSON.stringify(values);
}

function parseAttachments(value: unknown): ResourceAttachment[] {
  const parsed = parseJsonForDisplay(value);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((item): item is ResourceAttachment => {
    return (
      !!item &&
      typeof item === 'object' &&
      typeof item.name === 'string' &&
      typeof item.url === 'string' &&
      typeof item.size === 'number' &&
      typeof item.type === 'string'
    );
  });
}
