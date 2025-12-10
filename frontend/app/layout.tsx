import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "../components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "한국 주식 투자 리서치 AI Agent 시스템",
  description: "Multi-Agent 시스템을 활용한 실시간 투자 의견 제공",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <Navigation />
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900">{children}</main>
      </body>
    </html>
  );
}

