"use client";

import AgentOpinionCard from "../../../components/AgentOpinionCard";
import type { InvestmentOpinion } from "../../../lib/types";

interface MultiAgentTabProps {
  opinion: InvestmentOpinion;
}

export default function MultiAgentTab({ opinion }: MultiAgentTabProps) {
  const agents = [
    {
      name: "fundamental",
      recommendation: opinion.fundamental_rec,
      confidence: opinion.fundamental_confidence,
      reasoning: opinion.fundamental_reasoning,
    },
    {
      name: "technical",
      recommendation: opinion.technical_rec,
      confidence: opinion.technical_confidence,
      reasoning: opinion.technical_reasoning,
    },
    {
      name: "news",
      recommendation: opinion.news_rec,
      confidence: opinion.news_confidence,
      reasoning: opinion.news_reasoning,
    },
    {
      name: "macro",
      recommendation: opinion.macro_rec,
      confidence: opinion.macro_confidence,
      reasoning: opinion.macro_reasoning,
    },
    {
      name: "risk",
      recommendation: opinion.risk_rec,
      confidence: opinion.risk_confidence,
      reasoning: opinion.risk_reasoning,
    },
  ].filter(
    (agent) =>
      agent.recommendation &&
      agent.confidence !== undefined &&
      agent.reasoning &&
      agent.reasoning.length > 0
  );

  return (
    <div className="space-y-6">
      {/* 최종 의견 요약 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">최종 종합 의견</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-400">최종 의견</span>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {opinion.final_rec === "buy"
                ? "매수"
                : opinion.final_rec === "sell"
                  ? "매도"
                  : "보유"}
            </p>
          </div>
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-400">신뢰도</span>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {opinion.final_confidence}%
            </p>
          </div>
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-400">합의도</span>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {opinion.consensus_level || 0}%
            </p>
          </div>
        </div>

        {opinion.target_price && (
          <div className="mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">목표가: </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {opinion.target_price.toLocaleString()}원
            </span>
          </div>
        )}

        {opinion.stop_loss && (
          <div className="mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">손절가: </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {opinion.stop_loss.toLocaleString()}원
            </span>
          </div>
        )}

        {opinion.strategy && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">투자 전략</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{opinion.strategy}</p>
          </div>
        )}

        {opinion.key_reasons && opinion.key_reasons.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">주요 이유</h3>
            <ul className="space-y-1">
              {opinion.key_reasons.map((reason, index) => (
                <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                  • {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {opinion.risks && opinion.risks.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">리스크 요소</h3>
            <ul className="space-y-1">
              {opinion.risks.map((risk, index) => (
                <li key={index} className="text-sm text-red-600 dark:text-red-400">• {risk}</li>
              ))}
            </ul>
          </div>
        )}

        {opinion.had_debate && opinion.debate_summary && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">토론 요약</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{opinion.debate_summary}</p>
          </div>
        )}
      </div>

      {/* 각 Agent 의견 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Agent별 분석 의견</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {agents.map((agent) => (
            <AgentOpinionCard
              key={agent.name}
              agentName={agent.name}
              recommendation={agent.recommendation!}
              confidence={agent.confidence!}
              reasoning={agent.reasoning!}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

