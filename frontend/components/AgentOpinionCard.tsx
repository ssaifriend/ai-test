"use client";

interface AgentOpinionCardProps {
  agentName: string;
  recommendation: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string[];
}

export default function AgentOpinionCard({
  agentName,
  recommendation,
  confidence,
  reasoning,
}: AgentOpinionCardProps) {
  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "buy":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "sell":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "hold":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getRecommendationText = (rec: string) => {
    switch (rec) {
      case "buy":
        return "매수";
      case "sell":
        return "매도";
      case "hold":
        return "보유";
      default:
        return "분석 중";
    }
  };

  const getAgentName = (name: string) => {
    const names: Record<string, string> = {
      fundamental: "재무 분석",
      technical: "기술적 분석",
      news: "뉴스 감성",
      macro: "거시경제",
      risk: "리스크 관리",
    };
    return names[name] || name;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {getAgentName(agentName)}
        </h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${getRecommendationColor(
            recommendation
          )}`}
        >
          {getRecommendationText(recommendation)}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">신뢰도</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">{confidence}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {reasoning && reasoning.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">분석 근거</h4>
          <ul className="space-y-1">
            {reasoning.map((reason, index) => (
              <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                • {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

