/**
 * Debate Agent
 * 
 * Agent 간 토론을 조정하여 합의도를 높입니다.
 * 합의도가 70% 미만일 때만 토론을 진행합니다.
 */

import OpenAI from "openai";
import { loadEnv } from "../utils/env.ts";
import { logError } from "../utils/error-handler.ts";
import type { AgentOpinion } from "./fundamental.agent.ts";

export interface AgentOpinions {
  fundamental: AgentOpinion;
  technical: AgentOpinion;
  news: AgentOpinion;
  macro: AgentOpinion;
  risk: AgentOpinion;
}

export interface DebateResult {
  hadDebate: boolean;
  consensusLevel: number; // 0-100
  debateSummary?: string;
  changedAgents?: string[];
}

/**
 * 합의도 계산
 * 
 * @param opinions - 각 Agent의 의견
 * @returns 합의도 (0-100)
 */
export function calculateConsensus(opinions: AgentOpinions): number {
  const recommendations = [
    opinions.fundamental.recommendation,
    opinions.technical.recommendation,
    opinions.news.recommendation,
    opinions.macro.recommendation,
    opinions.risk.recommendation,
  ];

  // 각 의견의 가중치 (신뢰도 기반)
  const weights = [
    opinions.fundamental.confidence,
    opinions.technical.confidence,
    opinions.news.confidence,
    opinions.macro.confidence,
    opinions.risk.confidence,
  ];

  // 각 의견을 점수로 변환 (buy: 1, hold: 0, sell: -1)
  const scores = recommendations.map((rec) => {
    if (rec === "buy") return 1;
    if (rec === "sell") return -1;
    return 0;
  });

  // 가중 평균 계산
  const weightedSum = scores.reduce((sum, score, i) => sum + score * weights[i], 0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight === 0) {
    return 50; // 기본값
  }

  const averageScore = weightedSum / totalWeight;

  // 같은 의견을 가진 Agent 수 계산
  const buyCount = recommendations.filter((r) => r === "buy").length;
  const sellCount = recommendations.filter((r) => r === "sell").length;
  const holdCount = recommendations.filter((r) => r === "hold").length;

  // 다수 의견 비율
  const maxCount = Math.max(buyCount, sellCount, holdCount);
  const agreementRatio = maxCount / recommendations.length;

  // 합의도 = 다수 의견 비율 * 100
  return Math.round(agreementRatio * 100);
}

/**
 * Debate Agent 실행
 * 
 * @param opinions - 각 Agent의 의견
 * @returns 토론 결과
 */
export async function runDebateAgent(opinions: AgentOpinions): Promise<DebateResult> {
  const consensusLevel = calculateConsensus(opinions);

  // 합의도가 70% 이상이면 토론 불필요
  if (consensusLevel >= 70) {
    return {
      hadDebate: false,
      consensusLevel,
    };
  }

  const { openaiApiKey } = loadEnv();
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // 토론 프롬프트 작성
  const prompt = `다음 5명의 투자 전문가가 종목에 대해 서로 다른 의견을 가지고 있습니다. 이들의 의견을 조율하여 합의점을 찾아주세요.

[Fundamental Agent]
의견: ${opinions.fundamental.recommendation}
신뢰도: ${opinions.fundamental.confidence}%
근거: ${opinions.fundamental.reasoning.join(", ")}

[Technical Agent]
의견: ${opinions.technical.recommendation}
신뢰도: ${opinions.technical.confidence}%
근거: ${opinions.technical.reasoning.join(", ")}

[News Agent]
의견: ${opinions.news.recommendation}
신뢰도: ${opinions.news.confidence}%
근거: ${opinions.news.reasoning.join(", ")}

[Macro Agent]
의견: ${opinions.macro.recommendation}
신뢰도: ${opinions.macro.confidence}%
근거: ${opinions.macro.reasoning.join(", ")}

[Risk Agent]
의견: ${opinions.risk.recommendation}
신뢰도: ${opinions.risk.confidence}%
근거: ${opinions.risk.reasoning.join(", ")}

현재 합의도: ${consensusLevel}%

각 전문가의 의견을 검토하고, 토론을 통해 합의점을 찾아주세요. 다음 JSON 형식으로 응답하세요:
{
  "consensusLevel": 0-100,
  "debateSummary": "토론 요약 (200자 이내)",
  "changedAgents": ["의견이 변경된 Agent 이름들"]
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a moderator facilitating a debate among investment experts. Help them reach consensus by synthesizing their different viewpoints.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM 응답이 비어있습니다.");
    }

    const parsed = JSON.parse(content) as {
      consensusLevel: number;
      debateSummary: string;
      changedAgents?: string[];
    };

    return {
      hadDebate: true,
      consensusLevel: Math.max(0, Math.min(100, parsed.consensusLevel || consensusLevel)),
      debateSummary: parsed.debateSummary || "토론 완료",
      changedAgents: Array.isArray(parsed.changedAgents) ? parsed.changedAgents : [],
    };
  } catch (error) {
    logError("Debate Agent 실행 실패:", error);

    return {
      hadDebate: true,
      consensusLevel,
      debateSummary: "토론 중 오류 발생",
    };
  }
}

