"use client";

import OpinionHistoryChart from "../../../components/OpinionHistoryChart";
import type { InvestmentOpinion } from "../../../lib/types";

interface RealtimeTrackerTabProps {
  opinions: InvestmentOpinion[];
}

export default function RealtimeTrackerTab({ opinions }: RealtimeTrackerTabProps) {
  if (opinions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">의견 히스토리가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OpinionHistoryChart opinions={opinions} />

      {/* 최근 의견 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          최근 의견 목록
        </h3>
        <div className="space-y-4">
          {opinions.slice(0, 10).map((opinion) => (
            <div
              key={opinion.id}
              className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(opinion.timestamp).toLocaleString("ko-KR")}
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    opinion.final_rec === "buy"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                      : opinion.final_rec === "sell"
                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                  }`}
                >
                  {opinion.final_rec === "buy"
                    ? "매수"
                    : opinion.final_rec === "sell"
                      ? "매도"
                      : "보유"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  신뢰도: {opinion.final_confidence}%
                </span>
                {opinion.consensus_level !== undefined && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    합의도: {opinion.consensus_level}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

