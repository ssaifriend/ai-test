import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한국 주식 투자 리서치 AI Agent",
  description: "Multi-Agent 시스템을 활용한 실시간 투자 의견 제공",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

