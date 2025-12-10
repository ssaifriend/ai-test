"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { NewsArticle } from "../lib/types";

interface NewsTimelineChartProps {
  news: NewsArticle[];
}

export default function NewsTimelineChart({ news }: NewsTimelineChartProps) {
  // 날짜별로 그룹화하고 감성별 카운트
  const newsByDate = news.reduce((acc, article) => {
    if (!article.published_at) return acc;

    const date = new Date(article.published_at).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });

    if (!acc[date]) {
      acc[date] = { date, positive: 0, negative: 0, neutral: 0 };
    }

    if (article.sentiment === "positive") {
      acc[date].positive++;
    } else if (article.sentiment === "negative") {
      acc[date].negative++;
    } else {
      acc[date].neutral++;
    }

    return acc;
  }, {} as Record<string, { date: string; positive: number; negative: number; neutral: number }>);

  const chartData = Object.values(newsByDate).reverse();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        뉴스 감성 트렌드
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#6b7280" }}
            style={{ fontSize: "12px" }}
          />
          <YAxis tick={{ fill: "#6b7280" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="positive"
            name="긍정"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="negative"
            name="부정"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="neutral"
            name="중립"
            stroke="#6b7280"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

