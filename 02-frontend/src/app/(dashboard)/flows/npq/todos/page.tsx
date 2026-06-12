'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle2, Clock } from 'lucide-react';

type Todo = {
  type: string;
  projectId: string;
  projectName: string;
  parentId: string;
  childId: string | null;
  stage: string;
  title: string;
  parentTitle: string;
  status: string;
  dueAt: string | null;
};
type Notification = { id: string; type: string; title: string; body: string | null; status: string; createdAt: string };

const typeLabel: Record<string, string> = {
  returned: '退回',
  overdue: '逾期',
  missing_attachment: '待补交付件',
  responsibility: '责任项',
  pending_parent_close: '待关闭母任务',
};

export default function MyTodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/npq/my-todos');
    if (res.ok) {
      const data = await res.json();
      setTodos(data.todos ?? []);
      setNotifications(data.notifications ?? []);
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  async function markRead(notificationId: string) {
    await fetch('/api/npq/my-todos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });
    load();
  }

  if (loading) return <div className="p-8 text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">我的待办</h1>
          <div className="mt-1 text-sm text-muted-foreground">责任项、退回、到期和站内提醒</div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-lg border border-border bg-white">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">待办事项</div>
            {todos.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">暂无待办</div>
            ) : (
              <div className="divide-y divide-border">
                {todos.map((todo, index) => (
                  <Link key={`${todo.type}-${todo.childId ?? todo.parentId}-${index}`} href={`/flows/npq/activities`} className="block px-4 py-3 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-xs ${todo.type === 'overdue' ? 'bg-red-100 text-red-700' : todo.type === 'returned' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                            {typeLabel[todo.type] ?? todo.type}
                          </span>
                          <span className="truncate text-sm font-medium">{todo.title}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{todo.projectName} / {todo.stage} / {todo.parentTitle}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {todo.dueAt ? new Date(todo.dueAt).toLocaleDateString('zh-CN') : '-'}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-lg border border-border bg-white">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium">
              <Bell className="h-4 w-4" />站内提醒
            </div>
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">暂无提醒</div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <div key={notification.id} className="px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{notification.title}</div>
                        {notification.body && <div className="mt-1 text-xs text-muted-foreground">{notification.body}</div>}
                      </div>
                      {notification.status === 'unread' && (
                        <button onClick={() => markRead(notification.id)} className="rounded p-1 text-muted-foreground hover:text-green-700" title="标记已读">
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(notification.createdAt).toLocaleString('zh-CN', { hour12: false })}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
