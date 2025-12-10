/**
 * Synthesis Agent
 * 
 * 모든 Agent의 의견을 종합하여 최종 투자 의견을 생성합니다.
 * 조건부 모델 선택: GPT-4o-mini (80%) / GPT-4o (20%)
 */

import OpenAI from "openai";
import { loadEnv } from "../utils/env.ts";
import { logError } from "../utils/error-handler.ts";
import type { AgentOpinions } from "./debate.agent.ts";
import type { DebateResult } from "./debate.agent.ts";

export interface SynthesisResult {
  finalRecommendation: "buy" | "sell" | "hold";
  finalConfidence: number; // 0-100
  targetPrice?: number;
  stopLoss?: number;
  timeHorizon?: string;
  strategy: string;
  keyReasons: string[];
  risks: string[];
  synthesisModel: "gpt-4o-mini" | "gpt-4o";
}

/**
 * 모델 선택 (80% GPT-4o-mini, 20% GPT-4o)
 */
function selectModel(): "gpt-4o-mini" | "gpt-4o" {
  const random = Math.random();
  return random < 0.8 ? "gpt-4o-mini" : "gpt-4o";
}

/**
 * Synthesis Agent 실행
 * 
 * @param opinions - 각 Agent의 의견
 * @param debateResult - 토론 결과
 * @returns 최종 종합 의견
 */
export async function runSynthesisAgent(
  stockName: string,
  stockCode: string,
  opinions: AgentOpinions,
  debateResult: DebateResult
): Promise<SynthesisResult> {
  const { openaiApiKey } = loadEnv();
  const openai = new OpenAI({ apiKey: openaiApiKey });

  const model = selectModel();

  // 종합 프롬프트 작성
  const prompt = `다음 5명의 투자 전문가가 ${stockName} (${stockCode}) 종목에 대해 분석한 결과를 종합하여 최종 투자 의견을 제시하세요.

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

${debateResult.hadDebate ? `\n[토론 결과]\n합의도: ${debateResult.consensusLevel}%\n요약: ${debateResult.debateSummary || ""}` : ""}

위 분석 결과를 종합하여 다음 JSON 형식으로 최종 투자 의견을 제시하세요:
{
  "finalRecommendation": "buy" | "sell" | "hold",
  "finalConfidence": 0-100,
  "targetPrice": 숫자 (선택사항),
  "stopLoss": 숫자 (선택사항),
  "timeHorizon": "단기" | "중기" | "장기" (선택사항),
  "strategy": "투자 전략 (200자 이내)",
  "keyReasons": ["주요 이유1", "주요 이유2", "주요 이유3"],
  "risks": ["리스크 요소1", "리스크 요소2"]
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a senior investment advisor synthesizing multiple expert opinions into a final investment recommendation. Provide clear reasoning, target price, stop loss, and risk factors.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM 응답이 비어있습니다.");
    }

    const parsed = JSON.parse(content) as {
      finalRecommendation: "buy" | "sell" | "hold";
      finalConfidence: number;
      targetPrice?: number;
      stopLoss?: number;
      timeHorizon?: string;
      strategy: string;
      keyReasons: string[];
      risks: string[];
    };

    // 유효성 검증
    if (!["buy", "sell", "hold"].includes(parsed.finalRecommendation)) {
      throw new Error("잘못된 finalRecommendation 값입니다.");
    }

    return {
      finalRecommendation: parsed.finalRecommendation,
      finalConfidence: Math.max(0, Math.min(100, parsed.finalConfidence || 50)),
      targetPrice: parsed.targetPrice,
      stopLoss: parsed.stopLoss,
      timeHorizon: parsed.timeHorizon,
      strategy: parsed.strategy || "종합 분석 완료",
      keyReasons: Array.isArray(parsed.keyReasons) ? parsed.keyReasons.slice(0, 5) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : [],
      synthesisModel: model,
    };
  } catch (error) {
    logError("Synthesis Agent 실행 실패:", error);

    // 기본값 반환
    return {
      finalRecommendation: "hold",
      finalConfidence: 50,
      strategy: "분석 중 오류 발생",
      keyReasons: [],
      risks: [],
      synthesisModel: model,
    };
  }
}

