'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

type MembershipRow = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; username: string; status: string };
};

type UserOption = { id: string; username: string; status: string };

type RoleValue = 'user' | 'reviewer' | 'admin';
type RoleFilter = 'all' | RoleValue;
type StatusFilter = 'all' | 'active' | 'disabled';

const ROLE_OPTIONS: { value: RoleValue; label: string }[] = [
  { value: 'admin', label: '管理员' },
  { value: 'reviewer', label: '审批人' },
  { value: 'user', label: '普通成员' },
];

const ROLE_ORDER: Record<RoleValue, number> = {
  admin: 0,
  reviewer: 1,
  user: 2,
};

export function AdminMembershipPanel() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [effectiveAdminCount, setEffectiveAdminCount] = useState(0);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function reload() {
    const res = await fetch('/api/ai-resources/admin/memberships', { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(getErrorMessage(body, '加载成员失败'));
      return;
    }
    setUsers(body.users ?? []);
    setMemberships(body.memberships ?? []);
    setEffectiveAdminCount(body.effectiveAdminCount ?? 0);
    setError('');
  }

  useEffect(() => {
    startTransition(() => {
      void reload();
    });
  }, []);

  const rows = useMemo(() => {
    const roleByUser = new Map(memberships.map((item) => [item.userId, item.role as RoleValue]));
    const keyword = query.trim().toLowerCase();

    return users
      .map((user) => ({
        ...user,
        role: roleByUser.get(user.id) ?? ('user' as RoleValue),
      }))
      .filter((user) => {
        if (roleFilter !== 'all' && user.role !== roleFilter) return false;
        if (statusFilter !== 'all' && user.status !== statusFilter) return false;
        if (keyword && !user.username.toLowerCase().includes(keyword)) return false;
        return true;
      })
      .sort((left, right) => {
        const byRole = ROLE_ORDER[left.role] - ROLE_ORDER[right.role];
        if (byRole !== 0) return byRole;
        return left.username.localeCompare(right.username, 'zh-CN');
      });
  }, [users, memberships, query, roleFilter, statusFilter]);

  function updateRole(userId: string, role: RoleValue) {
    startTransition(async () => {
      setSavingUserId(userId);
      setMessage('');
      setError('');
      const res = await fetch('/api/ai-resources/admin/memberships', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const body = await res.json().catch(() => null);
      setSavingUserId(null);
      if (!res.ok) {
        setError(getErrorMessage(body, '保存失败'));
        return;
      }
      setMessage('角色已更新');
      await reload();
    });
  }

  const hasFilter = query.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'active';

  return (
    <div className="roles-panel">
      <div className="roles-toolbar">
        <input
          className="roles-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索用户名"
          aria-label="搜索用户名"
        />
        <select
          className="roles-filter"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
          aria-label="按角色筛选"
        >
          <option value="all">全部角色</option>
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="roles-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          aria-label="按状态筛选"
        >
          <option value="all">全部状态</option>
          <option value="active">正常</option>
          <option value="disabled">停用</option>
        </select>
        {hasFilter ? (
          <button
            type="button"
            className="button roles-filter-reset"
            onClick={() => {
              setQuery('');
              setRoleFilter('all');
              setStatusFilter('active');
            }}
          >
            清空
          </button>
        ) : null}
      </div>

      <div className="roles-panel-meta">
        <span>
          显示 {rows.length}/{users.length} · 管理员 {effectiveAdminCount}
        </span>
        {message ? <span className="roles-panel-ok">{message}</span> : null}
        {error ? <span className="roles-panel-error">{error}</span> : null}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table roles-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>状态</th>
              <th>角色</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.username}</td>
                  <td>
                    <span className={`roles-status${row.status === 'active' ? ' is-active' : ''}`}>
                      {row.status === 'active' ? '正常' : '停用'}
                    </span>
                  </td>
                  <td>
                    <select
                      className="roles-select"
                      value={row.role}
                      disabled={pending || savingUserId === row.id}
                      onChange={(event) => updateRole(row.id, event.target.value as RoleValue)}
                      aria-label={`${row.username} 的角色`}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="subtle">
                  {pending ? '加载中…' : hasFilter ? '没有匹配的用户' : '暂无可用用户'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="subtle roles-panel-hint">至少保留一名有效管理员</p>
    </div>
  );
}
