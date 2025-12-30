"use client";

import type { InvestmentOpinion } from "../lib/types";

interface AgentOpinionsProps {
  opinion: InvestmentOpinion;
}

export default function AgentOpinions({ opinion }: AgentOpinionsProps) {
  const getRecommendationBadge = (rec?: string) => {
    switch (rec) {
      case "buy":
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">매수</span>;
      case "sell":
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">매도</span>;
      case "hold":
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">보유</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">-</span>;
    }
  };

  const agents = [
    {
      name: "Fundamental",
      displayName: "재무 분석",
      rec: opinion.fundamental_rec,
      confidence: opinion.fundamental_confidence,
      reasoning: opinion.fundamental_reasoning,
      targetPrice: opinion.fundamental_target_price,
      stopLoss: opinion.fundamental_stop_loss,
    },
    {
      name: "Technical",
      displayName: "기술적 분석",
      rec: opinion.technical_rec,
      confidence: opinion.technical_confidence,
      reasoning: opinion.technical_reasoning,
      targetPrice: opinion.technical_target_price,
      stopLoss: opinion.technical_stop_loss,
    },
    {
      name: "News",
      displayName: "뉴스 분석",
      rec: opinion.news_rec,
      confidence: opinion.news_confidence,
      reasoning: opinion.news_reasoning,
    },
    {
      name: "Macro",
      displayName: "거시경제 분석",
      rec: opinion.macro_rec,
      confidence: opinion.macro_confidence,
      reasoning: opinion.macro_reasoning,
    },
    {
      name: "Risk",
      displayName: "리스크 분석",
      rec: opinion.risk_rec,
      confidence: opinion.risk_confidence,
      reasoning: opinion.risk_reasoning,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
        Agent별 상세 의견
      </h2>

      <div className="space-y-4">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {agent.displayName}
              </h3>
              <div className="flex items-center gap-3">
                {getRecommendationBadge(agent.rec)}
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  신뢰도: {agent.confidence || 0}%
                </span>
              </div>
            </div>

            {/* 목표가/손절가 */}
            {(agent.targetPrice || agent.stopLoss) && (
              <div className="grid grid-cols-2 gap-4 mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                {agent.targetPrice && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      목표가
                    </div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {agent.targetPrice.toLocaleString()}원
                      {opinion.current_price && (
                        <span className="ml-2 text-xs font-normal">
                          ({((agent.targetPrice - opinion.current_price) / opinion.current_price * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {agent.stopLoss && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      손절가
                    </div>
                    <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                      {agent.stopLoss.toLocaleString()}원
                      {opinion.current_price && (
                        <span className="ml-2 text-xs font-normal">
                          ({((agent.stopLoss - opinion.current_price) / opinion.current_price * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 근거 */}
            {agent.reasoning && agent.reasoning.length > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  분석 근거:
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {agent.reasoning.map((reason, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-gray-600 dark:text-gray-400"
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
