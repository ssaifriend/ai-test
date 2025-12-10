"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface FilteringStats {
  id: string;
  stock_id: string;
  collected_at: string;
  time_period: "peak" | "active" | "off";
  raw_count: number;
  after_source_filter: number;
  after_dedup: number;
  after_quality_filter: number;
  final_count: number;
  high_importance_count: number;
  filter_rate: number;
  avg_similarity: number;
}

interface FilteringStatsPanelProps {
  stats: FilteringStats[];
}

export default function FilteringStatsPanel({ stats }: FilteringStatsPanelProps) {
  if (stats.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">필터링 통계 데이터가 없습니다.</p>
      </div>
    );
  }

  // 시간대별 그룹화
  const statsByPeriod = stats.reduce(
    (acc, stat) => {
      if (!acc[stat.time_period]) {
        acc[stat.time_period] = [];
      }
      acc[stat.time_period].push(stat);
      return acc;
    },
    {} as Record<string, FilteringStats[]>
  );

  // 차트 데이터 준비
  const chartData = Object.entries(statsByPeriod).map(([period, periodStats]) => {
    const avgRaw = Math.round(
      periodStats.reduce((sum, s) => sum + s.raw_count, 0) / periodStats.length
    );
    const avgFinal = Math.round(
      periodStats.reduce((sum, s) => sum + s.final_count, 0) / periodStats.length
    );
    const avgFilterRate =
      periodStats.reduce((sum, s) => sum + s.filter_rate, 0) / periodStats.length;

    return {
      period: period === "peak" ? "핵심 시간" : period === "active" ? "활동 시간" : "장외 시간",
      원본: avgRaw,
      최종: avgFinal,
      필터링율: Math.round(avgFilterRate),
    };
  });

  // 최근 통계 요약
  const latestStats = stats
    .sort((a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 차트 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          시간대별 필터링 통계
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
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
            <Bar dataKey="원본" fill="#ef4444" />
            <Bar dataKey="최종" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 최근 통계 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          최근 필터링 통계
        </h3>
        <div className="space-y-4">
          {latestStats.map((stat) => (
            <div
              key={stat.id}
              className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {stat.time_period === "peak"
                    ? "핵심 시간"
                    : stat.time_period === "active"
                      ? "활동 시간"
                      : "장외 시간"}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(stat.collected_at).toLocaleString("ko-KR")}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">원본</span>
                  <p className="font-semibold text-gray-900 dark:text-white">{stat.raw_count}개</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">최종</span>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {stat.final_count}개
                  </p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">필터링율</span>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {stat.filter_rate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">고중요도</span>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {stat.high_importance_count}개
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span>필터링 파이프라인</span>
                  <span>{stat.filter_rate.toFixed(1)}% 제거</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                    style={{ width: `${100 - stat.filter_rate}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

