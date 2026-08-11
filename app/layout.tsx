import type { Metadata } from "next";
import "./globals.css";
import FeedbackWidget from "@/components/feedback/feedback-widget";
import { getSession } from "@/platform/auth/auth.config";

export const metadata: Metadata = {
  title: '供应链质量部 AI 综合工作台',
  description: '新品质量策划 · 统一 AI 应用平台',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        {children}
        <FeedbackWidget enabled={Boolean(session)} />
      </body>
    </html>
  );
}
