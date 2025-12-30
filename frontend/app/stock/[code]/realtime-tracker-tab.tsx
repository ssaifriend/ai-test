"use client";

import OpinionHistoryChart from "../../../components/OpinionHistoryChart";
import { useRealtimeOpinions } from "../../../hooks/useRealtimeOpinions";
import type { InvestmentOpinion } from "../../../lib/types";

interface RealtimeTrackerTabProps {
  stockId: string;
  initialOpinions: InvestmentOpinion[];
}

export default function RealtimeTrackerTab({
  stockId,
  initialOpinions,
}: RealtimeTrackerTabProps) {
  const { opinions, loading } = useRealtimeOpinions(stockId);
  const displayOpinions = opinions.length > 0 ? opinions : initialOpinions;
  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">로딩 중...</p>
      </div>
    );
  }

  if (displayOpinions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">의견 히스토리가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OpinionHistoryChart opinions={displayOpinions} />

      {/* 최근 의견 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          최근 의견 목록
        </h3>
        <div className="space-y-6">
          {displayOpinions.slice(0, 10).map((opinion) => (
            <div
              key={opinion.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {/* 헤더: 날짜 + 의견 */}
              <div className="flex justify-between items-start mb-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(opinion.timestamp).toLocaleString("ko-KR")}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
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

              {/* 주요 메트릭 */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">신뢰도</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {opinion.final_confidence}%
                  </div>
                </div>
                {opinion.consensus_level !== undefined && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">합의도</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {opinion.consensus_level}%
                    </div>
                  </div>
                )}
              </div>

              {/* 가격 정보 */}
              {(opinion.current_price || opinion.target_price || opinion.stop_loss) && (
                <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                  {opinion.current_price && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">현재가</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {opinion.current_price.toLocaleString()}원
                      </div>
                    </div>
                  )}
                  {opinion.target_price && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">목표가</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {opinion.target_price.toLocaleString()}원
                        {opinion.current_price && (() => {
                          const changePercent = ((opinion.target_price - opinion.current_price) / opinion.current_price) * 100;
                          const isPositive = changePercent > 0;
                          return (
                            <span className={`ml-1 text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              ({isPositive ? '+' : ''}{changePercent.toFixed(1)}%)
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  {opinion.stop_loss && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">손절가</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {opinion.stop_loss.toLocaleString()}원
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 전략 */}
              {opinion.strategy && (
                <div className="mb-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">투자 전략</div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {opinion.strategy}
                  </p>
                </div>
              )}

              {/* 주요 이유 */}
              {opinion.key_reasons && opinion.key_reasons.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">주요 이유</div>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    {opinion.key_reasons.slice(0, 3).map((reason, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 메타 정보 */}
              <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                {opinion.time_horizon && (
                  <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {opinion.time_horizon}
                  </span>
                )}
                {opinion.had_debate && (
                  <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300 px-2 py-1 rounded">
                    토론 진행
                  </span>
                )}
                {opinion.generation_time_ms && (
                  <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    생성 시간: {(opinion.generation_time_ms / 1000).toFixed(1)}초
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

