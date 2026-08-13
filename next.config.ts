import os from 'node:os';
import type { NextConfig } from 'next';

function localIpv4Addresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item): item is os.NetworkInterfaceInfo => Boolean(item && item.family === 'IPv4' && !item.internal))
    .map((item) => item.address);
}

const defaultDevOrigins = [
  'localhost',
  '127.0.0.1',
  ...localIpv4Addresses(),
];

const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? defaultDevOrigins.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  experimental: {
    cpus: Number(process.env.NEXT_BUILD_CPUS ?? 2),
    proxyClientMaxBodySize: '1mb',
  },
  output: 'standalone',
  serverExternalPackages: ['pg', 'minio'],
  outputFileTracingIncludes: {
    '/*': ['./drizzle/**/*', './db/seed-data/**/*'],
  },
  // 🔧 M5: 安全响应头
  async headers() {
    return [
      {
        // 托管 HTML 可被同站 iframe 嵌入，不设置 X-Frame-Options
        source: '/api/ai-resources/resources/:id/html',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '0' },
        ],
      },
      {
        // 排除 resources API（含 HTML 预览），避免与上面规则合并出 DENY
        source: '/((?!api/ai-resources/resources/).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '0' },
        ],
      },
      {
        // Launch-code 页面跨站 POST 时不向独立应用发送工作台来源。
        source: '/sqm/drawing-reliability',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        // 通用外挂 SSO launcher 同样不缓存，也不发送工作台来源。
        source: '/portal/external-apps/:id',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
