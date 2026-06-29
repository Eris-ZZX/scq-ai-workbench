'use client';

import { useState } from 'react';

const TEST_ACCOUNTS = [
  'admin',
  'manager',
  '\u6d4b\u8bd5NPQ1',
  '\u6d4b\u8bd5NPQ2',
  '\u6d4b\u8bd5PQE1',
  '\u6d4b\u8bd5PQE2',
  '\u6d4b\u8bd5SQE1',
  '\u6d4b\u8bd5SQE2',
  '\u6d4b\u8bd5EMS1',
  '\u6d4b\u8bd5EMS2',
  '\u6d4b\u8bd5FAE1',
  '\u6d4b\u8bd5FAE2',
  '\u6d4b\u8bd5RAM1',
  '\u6d4b\u8bd5RAM2',
  '\u6d4b\u8bd5QCM1',
  '\u6d4b\u8bd5QCM2',
];
const TEST_PASSWORD = 'qe123456';

export function QuickLoginBar() {
  const [loading, setLoading] = useState('');

  async function quickLogin(username: string) {
    setLoading(username);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: TEST_PASSWORD }),
      });

      if (res.ok) {
        window.location.assign('/workbench');
        return;
      }

      const data = await res.json().catch(() => ({}));
      alert(data.error ?? '\u767b\u5f55\u5931\u8d25');
    } catch {
      alert('\u7f51\u7edc\u9519\u8bef');
    } finally {
      setLoading('');
    }
  }

  return (
    <div className="mt-5 rounded-md bg-muted/50 p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        {'\u6d4b\u8bd5\u8d26\u53f7\uff08\u5bc6\u7801 qe123456\uff09\uff0c\u70b9\u51fb\u76f4\u63a5\u767b\u5f55'}
      </div>
      <div className="flex flex-wrap gap-1">
        {TEST_ACCOUNTS.map((account) => (
          <button
            key={account}
            type="button"
            disabled={loading !== ''}
            onClick={() => quickLogin(account)}
            className="rounded border border-border bg-white px-2 py-1 text-xs text-foreground hover:border-primary disabled:opacity-50"
          >
            {loading === account ? '...' : account}
          </button>
        ))}
      </div>
    </div>
  );
}
