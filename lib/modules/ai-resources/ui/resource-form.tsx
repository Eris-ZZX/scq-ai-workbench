'use client';

import type { AiResourceRecord as AiResource } from '@/db/types';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronDown, FileCode2, Paperclip, Plus, Send, Trash2 } from 'lucide-react';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';
import type { AiResourceType } from '@/modules/ai-resources/constants';
import {
  AI_CONTENT_MAX_LENGTH,
  AI_SUMMARY_MAX_LENGTH,
  AI_UPLOAD_MAX_ATTACHMENTS,
  AI_UPLOAD_MAX_FILE_SIZE_BYTES,
  AI_UPLOAD_MAX_FILE_SIZE_LABEL,
  AI_HOSTED_HTML_MAX_FILE_SIZE_BYTES,
  AI_HOSTED_HTML_MAX_FILE_SIZE_LABEL,
} from '@/modules/ai-resources/constants';
import {
  buildExtensionWithHostedHtml,
  isHtmlFileName,
  parseHostedHtml,
  storedNameFromUploadUrl,
  type HostedHtmlMeta,
} from '@/modules/ai-resources/hosted-html';
import { parseJsonForDisplay } from '@/modules/ai-resources/json';
import type { AiResourceUserOption } from '@/modules/ai-resources/users';

type ResourceFormProps = {
  resource?: AiResource;
  directUpdate?: boolean;
  /** 对被驳回单据重新提交（同一审批单） */
  resubmitReviewId?: string;
  initialReviewerId?: string | null;
  initialOwnerId?: string;
  initialOwnerName?: string;
};

type ResourceAttachment = {
  name: string;
  url: string;
  size: number;
  type: string;
  storedName?: string;
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

export function ResourceForm({
  resource,
  directUpdate = false,
  resubmitReviewId,
  initialReviewerId,
  initialOwnerId,
  initialOwnerName,
}: ResourceFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [attachments, setAttachments] = useState<ResourceAttachment[]>(() =>
    parseAttachments(resource?.attachments),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [reviewers, setReviewers] = useState<Array<{ id: string; username: string; displayName?: string | null; role: string }>>([]);
  const [reviewerId, setReviewerId] = useState(initialReviewerId ?? '');
  const [ownerUsers, setOwnerUsers] = useState<AiResourceUserOption[]>([]);
  const [ownerQuery, setOwnerQuery] = useState(resource?.ownerName ?? initialOwnerName ?? '');
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [hostedHtml, setHostedHtml] = useState<HostedHtmlMeta | null>(() =>
    parseHostedHtml(resource?.extension),
  );
  const [hostedHtmlFile, setHostedHtmlFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: resource?.name ?? '',
    type: (resource?.type ?? 'AGENT') as AiResourceType,
    summary: resource?.summary ?? '',
    groups: resource?.tags ? resource.tags.split(',').filter(Boolean) : [],
    ownerId: resource?.ownerId ?? initialOwnerId ?? '',
    ownerName: resource?.ownerName ?? initialOwnerName ?? '',
    resourceUrls: parseResourceUrls(resource?.resourceUrl),
    content: resource?.content ?? '',
    updateSummary: '',
  });

  const endpoint = resubmitReviewId
    ? `/api/ai-resources/review-requests/${resubmitReviewId}/resubmit`
    : resource
      ? directUpdate
        ? `/api/ai-resources/admin/resources/${resource.id}`
        : `/api/ai-resources/resources/${resource.id}/change-request`
      : '/api/ai-resources/resources/draft';
  const submitMethod = directUpdate && !resubmitReviewId ? 'PATCH' : 'POST';
  const title = resubmitReviewId
    ? '重新提交审批'
    : resource
      ? directUpdate
        ? '保存资源'
        : '提交修改审批'
      : '提交新资源审批';
  const isWebPage = form.type === 'WEB_PAGE';
  const needsReviewer = !directUpdate || Boolean(resubmitReviewId);

  useEffect(() => {
    if (!needsReviewer) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/ai-resources/reviewers');
        if (!response.ok) return;
        const data = (await response.json()) as {
          reviewers?: Array<{ id: string; username: string; displayName?: string | null; role: string }>;
        };
        if (cancelled) return;
        const list = data.reviewers ?? [];
        setReviewers(list);
        setReviewerId((current) => current || list[0]?.id || '');
      } catch {
        // keep empty; submit will surface validation error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsReviewer]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/ai-resources/users');
        if (!response.ok) return;
        const data = (await response.json()) as {
          users?: AiResourceUserOption[];
          currentUserId?: string;
        };
        if (cancelled) return;
        const list = data.users ?? [];
        const preferredId = resource?.ownerId || initialOwnerId || data.currentUserId || '';
        const preferred = list.find((user) => user.id === preferredId);
        setOwnerUsers(list);
        setForm((current) => ({
          ...current,
          ownerId: preferred?.id ?? current.ownerId,
          ownerName: preferred?.displayName || preferred?.username || current.ownerName,
        }));
        if (preferred) setOwnerQuery(preferred.displayName || preferred.username);
      } catch {
        // keep empty; submit will surface validation error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resource?.ownerId, initialOwnerId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setMessage(null);
    try {
      if (needsReviewer && !reviewerId) {
        setMessage('请选择审批人。');
        return;
      }
      const selectedOwner =
        ownerUsers.find((user) => user.id === form.ownerId) ??
        ownerUsers.find((user) => user.username === ownerQuery.trim());
      if (!selectedOwner) {
        setMessage('请选择负责人。');
        return;
      }
      if (form.summary.length > AI_SUMMARY_MAX_LENGTH) {
        setMessage(`面向用户/使用说明不能超过 ${AI_SUMMARY_MAX_LENGTH.toLocaleString('zh-CN')} 字。`);
        return;
      }
      if (form.content.length > AI_CONTENT_MAX_LENGTH) {
        setMessage(`实现方法简述不能超过 ${AI_CONTENT_MAX_LENGTH.toLocaleString('zh-CN')} 字。`);
        return;
      }

      const uploadedAttachments = await uploadSelectedFiles();
      const nextHostedHtml = isWebPage ? await uploadHostedHtmlIfNeeded() : null;
      const extension = isWebPage
        ? buildExtensionWithHostedHtml(resource?.extension, nextHostedHtml)
        : buildExtensionWithHostedHtml(resource?.extension, null);

      const response = await fetch(endpoint, {
        method: submitMethod,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          updateSummary: resubmitReviewId
            ? form.updateSummary.trim() || '按驳回意见修改后重新提交'
            : resource
              ? form.updateSummary
              : '首次上传',
          ...(needsReviewer ? { reviewerId } : {}),
          resource: {
            name: form.name,
            type: form.type,
            summary: form.summary,
            tags: form.groups,
            ownerId: selectedOwner.id,
            ownerName: selectedOwner.displayName || selectedOwner.username,
            visibilityScope: 'ALL',
            resourceUrl: serializeResourceUrls(form.resourceUrls),
            content: form.content,
            attachments: uploadedAttachments,
            extension,
            extractedText: form.content,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        setMessage(getErrorMessage(error, '提交失败。'));
        return;
      }

      setMessage(directUpdate && !resubmitReviewId ? '资源已保存。' : '已提交审批。');
      if (resubmitReviewId) {
        router.push(`/ai-resources/review/${resubmitReviewId}`);
      } else {
        router.push(directUpdate && resource ? `/ai-resources/${resource.id}` : '/ai-resources/review');
      }
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

  function updateOwnerQuery(value: string) {
    setOwnerQuery(value);
    const selected = ownerUsers.find(
      (user) => user.username === value.trim() || user.displayName === value.trim(),
    );
    setForm((current) => ({
      ...current,
      ownerId: selected?.id ?? '',
      ownerName: value,
    }));
    setOwnerOpen(true);
  }

  function selectOwner(user: AiResourceUserOption) {
    setForm((current) => ({
      ...current,
      ownerId: user.id,
      ownerName: user.displayName || user.username,
    }));
    setOwnerQuery(user.displayName || user.username);
    setOwnerOpen(false);
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

    if (attachments.length + files.length > AI_UPLOAD_MAX_ATTACHMENTS) {
      throw new Error(`每个资源最多 ${AI_UPLOAD_MAX_ATTACHMENTS} 个附件。`);
    }
    const oversized = files.find((file) => file.size > AI_UPLOAD_MAX_FILE_SIZE_BYTES);
    if (oversized) {
      throw new Error(`${oversized.name} 超过 ${AI_UPLOAD_MAX_FILE_SIZE_LABEL}，无法上传。`);
    }

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

  async function uploadHostedHtmlIfNeeded(): Promise<HostedHtmlMeta | null> {
    if (!hostedHtmlFile) return hostedHtml;
    if (!isHtmlFileName(hostedHtmlFile.name)) {
      throw new Error('仅支持上传 .html / .htm 文件。');
    }
    if (hostedHtmlFile.size > AI_HOSTED_HTML_MAX_FILE_SIZE_BYTES) {
      throw new Error(`托管 HTML 超过 ${AI_HOSTED_HTML_MAX_FILE_SIZE_LABEL}，无法上传。`);
    }

    const formData = new FormData();
    formData.append('purpose', 'hosted-html');
    formData.append('files', hostedHtmlFile);
    const response = await fetch('/api/ai-resources/uploads', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(getErrorMessage(error, '托管 HTML 上传失败。'));
    }

    const payload = (await response.json()) as {
      attachments?: Array<ResourceAttachment & { storedName?: string }>;
    };
    const uploaded = payload.attachments?.[0];
    if (!uploaded) throw new Error('托管 HTML 上传失败。');

    const storedName = uploaded.storedName || storedNameFromUploadUrl(uploaded.url);
    const next: HostedHtmlMeta = {
      storedName,
      originalName: uploaded.name,
      size: uploaded.size,
    };
    setHostedHtml(next);
    setHostedHtmlFile(null);
    return next;
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
          <div className="multi-dropdown owner-selector">
            <input
              value={ownerQuery}
              placeholder="输入用户名搜索"
              onFocus={() => setOwnerOpen(true)}
              onBlur={() => setTimeout(() => setOwnerOpen(false), 120)}
              onChange={(event) => updateOwnerQuery(event.target.value)}
              required
              aria-autocomplete="list"
              aria-controls="owner-options"
              aria-expanded={ownerOpen}
              role="combobox"
            />
            {ownerOpen ? (
              <div className="multi-dropdown-menu" id="owner-options" role="listbox">
                {ownerUsers
                  .filter((user) =>
                    (user.displayName || user.username).toLocaleLowerCase().includes(ownerQuery.trim().toLocaleLowerCase())
                    || user.username.toLocaleLowerCase().includes(ownerQuery.trim().toLocaleLowerCase()),
                  )
                  .slice(0, 50)
                  .map((user) => (
                    <button
                      type="button"
                      className="multi-dropdown-option owner-option"
                      key={user.id}
                      onClick={() => selectOwner(user)}
                    >
                      {user.displayName || user.username}
                    </button>
                  ))}
                {!ownerUsers.some((user) =>
                  (user.displayName || user.username).toLocaleLowerCase().includes(ownerQuery.trim().toLocaleLowerCase())
                  || user.username.toLocaleLowerCase().includes(ownerQuery.trim().toLocaleLowerCase()),
                ) ? (
                  <span className="subtle owner-empty">没有匹配的用户</span>
                ) : null}
              </div>
            ) : null}
          </div>
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

      {isWebPage ? (
        <div className="field">
          <label>托管 HTML（单文件）</label>
          <p className="subtle" style={{ margin: '0 0 8px' }}>
            仅支持一个 .html / .htm 文件（不超过 {AI_HOSTED_HTML_MAX_FILE_SIZE_LABEL}）；样式与脚本请内联，或引用公网地址。
          </p>
          <label className="file-picker">
            <input
              type="file"
              accept=".html,.htm,text/html"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                event.currentTarget.value = '';
                if (file && file.size > AI_HOSTED_HTML_MAX_FILE_SIZE_BYTES) {
                  setMessage(`托管 HTML 超过 ${AI_HOSTED_HTML_MAX_FILE_SIZE_LABEL}，无法上传。`);
                  return;
                }
                setMessage(null);
                setHostedHtmlFile(file);
              }}
            />
            <FileCode2 size={16} />
            选择 HTML 文件
          </label>
          {hostedHtml || hostedHtmlFile ? (
            <div className="attachment-list">
              {hostedHtmlFile ? (
                <span title={hostedHtmlFile.name}>{hostedHtmlFile.name}（待上传）</span>
              ) : hostedHtml ? (
                <span title={hostedHtml.originalName}>{hostedHtml.originalName}</span>
              ) : null}
              {hostedHtml && !hostedHtmlFile ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => setHostedHtml(null)}
                >
                  清除托管文件
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="field">
        <div className="field-label-row">
          <label>附件</label>
          <span className="field-limit-hint">
            最多 {AI_UPLOAD_MAX_ATTACHMENTS} 个，单个不超过 {AI_UPLOAD_MAX_FILE_SIZE_LABEL}
          </span>
        </div>
        <label className="file-picker">
          <input
            type="file"
            multiple
            disabled={attachments.length >= AI_UPLOAD_MAX_ATTACHMENTS}
            onChange={(event) => {
              const selected = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              if (!selected.length) return;

              const remaining = AI_UPLOAD_MAX_ATTACHMENTS - attachments.length;
              if (selected.length > remaining) {
                setMessage(`每个资源最多 ${AI_UPLOAD_MAX_ATTACHMENTS} 个附件。`);
                return;
              }
              const oversized = selected.find((file) => file.size > AI_UPLOAD_MAX_FILE_SIZE_BYTES);
              if (oversized) {
                setMessage(`${oversized.name} 超过 ${AI_UPLOAD_MAX_FILE_SIZE_LABEL}，无法上传。`);
                return;
              }
              setMessage(null);
              setFiles(selected);
            }}
          />
          <Paperclip size={16} />
          选择附件
        </label>
        {attachments.length || files.length ? (
          <div className="attachment-list">
            {attachments.map((attachment) => (
              <span key={attachment.url} className="attachment-chip">
                <a href={attachment.url} download title={attachment.name}>
                  {attachment.name}
                </a>
                <button
                  type="button"
                  className="icon-button"
                  title="移除附件"
                  onClick={() =>
                    setAttachments((current) => current.filter((item) => item.url !== attachment.url))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </span>
            ))}
            {files.map((file) => (
              <span key={`${file.name}-${file.size}`} title={file.name}>
                {file.name}（待上传）
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="field">
        <div className="field-label-row">
          <label>面向用户/使用说明</label>
          <span className="field-limit-hint">
            {form.summary.length.toLocaleString('zh-CN')} / {AI_SUMMARY_MAX_LENGTH.toLocaleString('zh-CN')} 字
          </span>
        </div>
        <textarea
          value={form.summary}
          maxLength={AI_SUMMARY_MAX_LENGTH}
          onChange={(event) => update('summary', event.target.value)}
          required
        />
      </div>
      <div className="field">
        <div className="field-label-row">
          <label>实现方法简述</label>
          <span className="field-limit-hint">
            {form.content.length.toLocaleString('zh-CN')} / {AI_CONTENT_MAX_LENGTH.toLocaleString('zh-CN')} 字
          </span>
        </div>
        <textarea
          value={form.content}
          maxLength={AI_CONTENT_MAX_LENGTH}
          onChange={(event) => update('content', event.target.value)}
          required
        />
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
      {needsReviewer ? (
        <div className="field">
          <div className="field-label-row">
            <label>审批人</label>
            <span className="field-limit-hint">仅指定的人会收到待审</span>
          </div>
          <select
            value={reviewerId}
            onChange={(event) => setReviewerId(event.target.value)}
            required
          >
            <option value="" disabled>
              {reviewers.length ? '请选择审批人' : '暂无可选审批人'}
            </option>
            {reviewers.map((reviewer) => (
              <option key={reviewer.id} value={reviewer.id}>
                {reviewer.displayName || reviewer.username}
                {reviewer.role === 'admin' ? '（管理员）' : ''}
              </option>
            ))}
          </select>
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

function createClientId() {
  // Public http://host:port is not a secure context; crypto.randomUUID() throws there.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through
    }
  }
  return `path-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createPath(value: string, label = ''): ResourcePath {
  return {
    id: createClientId(),
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
