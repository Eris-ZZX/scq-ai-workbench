import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: '供应链质量部 AI 综合工作台',
  description: '新品质量策划 · 统一 AI 应用平台',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
