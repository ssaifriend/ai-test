"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { InvestmentOpinion } from "../lib/types";

interface OpinionHistoryChartProps {
  opinions: InvestmentOpinion[];
}

export default function OpinionHistoryChart({ opinions }: OpinionHistoryChartProps) {
  // 데이터 변환: 의견을 숫자로 변환 (buy: 1, hold: 0, sell: -1)
  const chartData = opinions
    .map((opinion) => ({
      timestamp: new Date(opinion.timestamp).toLocaleDateString("ko-KR"),
      date: new Date(opinion.timestamp).toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      }),
      finalRec:
        opinion.final_rec === "buy" ? 1 : opinion.final_rec === "sell" ? -1 : 0,
      finalConfidence: opinion.final_confidence,
      consensusLevel: opinion.consensus_level || 0,
    }))
    .reverse(); // 시간순 정렬

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        의견 히스토리
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#6b7280" }}
            style={{ fontSize: "12px" }}
          />
          <YAxis
            domain={[-1.5, 1.5]}
            tick={{ fill: "#6b7280" }}
            tickFormatter={(value) => {
              if (value === 1) return "매수";
              if (value === -1) return "매도";
              return "보유";
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
            formatter={(value: number, name: string) => {
              if (name === "finalRec") {
                return value === 1 ? "매수" : value === -1 ? "매도" : "보유";
              }
              return `${value}%`;
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="finalRec"
            name="최종 의견"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="finalConfidence"
            name="신뢰도"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 4 }}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

