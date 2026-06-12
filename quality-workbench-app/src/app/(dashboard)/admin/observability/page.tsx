'use client';
import { useState, useEffect } from 'react';

type Stats = { totalRequests: number; todayRequests: number; todayErrors: number; avgDurationMs: number; p95DurationMs: number };
type Event = { id: string; traceId: string; eventType: string; path: string | null; method: string | null; statusCode: number | null; durationMs: number | null; errorMessage: string | null; timestamp: string };

export default function AdminObservabilityPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  async function load() {
    const [sRes, eRes] = await Promise.all([
      fetch('/api/admin/observability?type=stats'),
      fetch('/api/admin/observability?limit=50'),
    ]);
    if (sRes.ok) setStats(await sRes.json());
    if (eRes.ok) setEvents(await eRes.json());
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const filtered = filter ? events.filter(e => e.eventType === filter) : events;

  if (loading) return <div className="p-8 text-muted-foreground">加载中...</div>;

  return (
    <div className="min-h-screen bg-ws-content-bg">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground">运行日志</h1>

        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              ['总请求', stats.totalRequests],
              ['今日请求', stats.todayRequests],
              ['今日错误', stats.todayErrors],
              ['平均耗时', `${stats.avgDurationMs}ms`],
              ['P95 耗时', `${stats.p95DurationMs}ms`],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg border border-border bg-white p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{val}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-4 flex gap-2">
          {['','request','error','user_action'].map(t => (
            <button key={t||'all'} onClick={() => setFilter(t)}
              className={`rounded px-3 py-1 text-xs font-medium ${filter===t?'bg-primary text-primary-foreground':'bg-white border text-muted-foreground'}`}>
              {t||'全部'}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          {filtered.map(e => (
            <div key={e.id} className="flex items-center gap-3 rounded border border-border bg-white px-3 py-2 text-xs font-mono">
              <span className={`w-16 rounded px-1 py-0.5 text-center ${e.eventType==='error'?'bg-red-100 text-red-700':'bg-blue-50 text-blue-700'}`}>{e.eventType}</span>
              <span className="w-12 text-muted-foreground">{e.method??'-'}</span>
              <span className="flex-1 truncate">{e.path??'-'}</span>
              <span className={`w-10 text-right ${(e.statusCode??0)>=400?'text-red-600':'text-green-600'}`}>{e.statusCode??'-'}</span>
              <span className="w-16 text-right text-muted-foreground">{e.durationMs!=null?`${e.durationMs}ms`:''}</span>
              <span className="w-40 truncate text-muted-foreground">{e.errorMessage??''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
