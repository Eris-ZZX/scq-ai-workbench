'use client';

import { useEffect, useState, useTransition } from 'react';
import { getErrorMessage } from '@/modules/ai-resources/api-errors';

type MembershipRow = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; username: string; status: string };
};

type UserOption = { id: string; username: string; status: string };

export function AdminMembershipPanel() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [effectiveAdminCount, setEffectiveAdminCount] = useState(0);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'user' | 'reviewer' | 'admin'>('user');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  async function reload() {
    const res = await fetch('/api/ai-resources/admin/memberships', { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(getErrorMessage(body, '加载成员失败。'));
      return;
    }
    setUsers(body.users ?? []);
    setMemberships(body.memberships ?? []);
    setEffectiveAdminCount(body.effectiveAdminCount ?? 0);
    if (!userId && body.users?.[0]?.id) setUserId(body.users[0].id);
  }

  useEffect(() => {
    startTransition(() => {
      void reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save() {
    startTransition(async () => {
      setMessage('');
      const res = await fetch('/api/ai-resources/admin/memberships', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(getErrorMessage(body, '保存失败。'));
        return;
      }
      setMessage('成员角色已更新。');
      await reload();
    });
  }

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>模块角色</h2>
      <p className="subtle">有效管理员数：{effectiveAdminCount}（active ∧ Membership.admin）</p>

      <div className="form-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        <label>
          用户
          <select value={userId} onChange={(e) => setUserId(e.target.value)} disabled={pending}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
        </label>
        <label>
          角色
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'user' | 'reviewer' | 'admin')}
            disabled={pending}
          >
            <option value="user">user</option>
            <option value="reviewer">reviewer</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button type="button" className="primary" onClick={save} disabled={pending || !userId}>
          保存
        </button>
      </div>

      {message ? <p className="subtle">{message}</p> : null}

      <table className="table" style={{ marginTop: 16, width: '100%' }}>
        <thead>
          <tr>
            <th>用户</th>
            <th>账号状态</th>
            <th>模块角色</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((m) => (
            <tr key={m.id}>
              <td>{m.user.username}</td>
              <td>{m.user.status}</td>
              <td>{m.role}</td>
            </tr>
          ))}
          {memberships.length === 0 ? (
            <tr>
              <td colSpan={3} className="subtle">
                尚未配置模块成员（默认视为 user）
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
