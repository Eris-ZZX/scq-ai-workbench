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
  // 🔧 M5: 安全响应头
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
