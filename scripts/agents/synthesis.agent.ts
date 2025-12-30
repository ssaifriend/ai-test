/**
 * Synthesis Agent
 * 
 * 모든 Agent의 의견을 종합하여 최종 투자 의견을 생성합니다.
 * 조건부 모델 선택: GPT-4o-mini (80%) / GPT-4o (20%)
 */

import { createChatCompletion } from "../utils/openai-helper.ts";
import { logError } from "../utils/error-handler.ts";
import type { AgentOpinions } from "./debate.agent.ts";
import type { DebateResult } from "./debate.agent.ts";

export interface SynthesisResult {
  finalRecommendation: "buy" | "sell" | "hold";
  finalConfidence: number; // 0-100
  currentPrice?: number;
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
 * 목표가/손절가 검증
 * 현재가 대비 ±50% 이상 차이나면 비정상으로 간주
 */
function validatePrices(currentPrice: number | undefined, targetPrice: number | undefined, stopLoss: number | undefined): {
  valid: boolean;
  reason?: string;
} {
  if (!currentPrice) {
    return { valid: true }; // 현재가 없으면 검증 스킵
  }

  // 목표가 검증 (현재가 대비 -50% ~ +300% 범위)
  if (targetPrice !== undefined) {
    const targetDiff = ((targetPrice - currentPrice) / currentPrice) * 100;
    if (targetDiff < -50 || targetDiff > 300) {
      return {
        valid: false,
        reason: `목표가가 현재가 대비 ${targetDiff.toFixed(1)}%로 비정상적입니다. (허용 범위: -50% ~ +300%)`,
      };
    }
  }

  // 손절가 검증 (현재가 대비 -50% ~ +50% 범위)
  if (stopLoss !== undefined) {
    const stopDiff = ((stopLoss - currentPrice) / currentPrice) * 100;
    if (stopDiff < -50 || stopDiff > 50) {
      return {
        valid: false,
        reason: `손절가가 현재가 대비 ${stopDiff.toFixed(1)}%로 비정상적입니다. (허용 범위: -50% ~ +50%)`,
      };
    }
  }

  // 목표가와 손절가 관계 검증 (매수 시 목표가 > 손절가)
  if (targetPrice !== undefined && stopLoss !== undefined) {
    if (targetPrice <= stopLoss) {
      return {
        valid: false,
        reason: "목표가가 손절가보다 낮거나 같습니다.",
      };
    }
  }

  return { valid: true };
}

/**
 * Synthesis Agent 실행
 *
 * @param opinions - 각 Agent의 의견
 * @param debateResult - 토론 결과
 * @param currentPrice - 현재가 (검증용)
 * @returns 최종 종합 의견
 */
export async function runSynthesisAgent(
  stockName: string,
  stockCode: string,
  opinions: AgentOpinions,
  debateResult: DebateResult,
  stockId?: string,
  currentPrice?: number
): Promise<SynthesisResult> {

  const model = selectModel();

  // 종합 프롬프트 작성
  const basePrompt = `다음 5명의 투자 전문가가 ${stockName} (${stockCode}) 종목에 대해 분석한 결과를 종합하여 최종 투자 의견을 제시하세요.
${currentPrice ? `\n현재가: ${currentPrice.toLocaleString()}원` : ""}

[Fundamental Agent]
의견: ${opinions.fundamental.recommendation}
신뢰도: ${opinions.fundamental.confidence}%
근거: ${opinions.fundamental.reasoning.join(", ")}
${opinions.fundamental.targetPrice ? `목표가: ${opinions.fundamental.targetPrice.toLocaleString()}원` : ""}
${opinions.fundamental.stopLoss ? `손절가: ${opinions.fundamental.stopLoss.toLocaleString()}원` : ""}

[Technical Agent]
의견: ${opinions.technical.recommendation}
신뢰도: ${opinions.technical.confidence}%
근거: ${opinions.technical.reasoning.join(", ")}
${opinions.technical.targetPrice ? `목표가: ${opinions.technical.targetPrice.toLocaleString()}원` : ""}
${opinions.technical.stopLoss ? `손절가: ${opinions.technical.stopLoss.toLocaleString()}원` : ""}

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
  "targetPrice": 숫자 (선택사항, 현재가 대비 -50% ~ +300% 범위),
  "stopLoss": 숫자 (선택사항, 현재가 대비 -50% ~ +50% 범위),
  "timeHorizon": "단기" | "중기" | "장기" (선택사항),
  "strategy": "투자 전략 (200자 이내)",
  "keyReasons": ["주요 이유1", "주요 이유2", "주요 이유3"],
  "risks": ["리스크 요소1", "리스크 요소2"]
}

주의사항:
- targetPrice와 stopLoss는 반드시 현재가를 기준으로 합리적인 범위 내에서 설정하세요
- 목표가는 손절가보다 높아야 합니다

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  // 최대 2회 재시도 (가격 검증 실패 시)
  let attempts = 0;
  const maxAttempts = 2;
  let prompt = basePrompt;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const response = await createChatCompletion({
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
        operation: "synthesis",
        stock_id: stockId,
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

      // 가격 검증
      const validation = validatePrices(currentPrice, parsed.targetPrice, parsed.stopLoss);
      if (!validation.valid) {
        console.log(`⚠️  가격 검증 실패 (시도 ${attempts}/${maxAttempts}): ${validation.reason}`);

        if (attempts < maxAttempts) {
          // 재시도 프롬프트에 오류 사유 추가
          prompt = `${basePrompt}\n\n[이전 응답 오류]\n${validation.reason}\n\n위 오류를 수정하여 다시 응답하세요.`;
          continue;
        } else {
          // 최종 실패 시 가격 정보 제거
          console.log("❌ 가격 검증 최종 실패 - 목표가/손절가 제거");
          parsed.targetPrice = undefined;
          parsed.stopLoss = undefined;
        }
      }

      return {
        finalRecommendation: parsed.finalRecommendation,
        finalConfidence: Math.max(0, Math.min(100, parsed.finalConfidence || 50)),
        currentPrice,
        targetPrice: parsed.targetPrice,
        stopLoss: parsed.stopLoss,
        timeHorizon: parsed.timeHorizon,
        strategy: parsed.strategy || "종합 분석 완료",
        keyReasons: Array.isArray(parsed.keyReasons) ? parsed.keyReasons.slice(0, 5) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : [],
        synthesisModel: model,
      };
    } catch (error) {
      if (attempts >= maxAttempts) {
        logError("Synthesis Agent 실행 실패:", error);

        // 기본값 반환
        return {
          finalRecommendation: "hold",
          finalConfidence: 50,
          currentPrice,
          strategy: "분석 중 오류 발생",
          keyReasons: [],
          risks: [],
          synthesisModel: model,
        };
      }
      // 다음 시도로 계속
      console.log(`⚠️  Synthesis Agent 오류 (시도 ${attempts}/${maxAttempts}):`, error);
    }
  }

  // 여기 도달하면 안 되지만, 안전을 위해 기본값 반환
  return {
    finalRecommendation: "hold",
    finalConfidence: 50,
    currentPrice,
    strategy: "분석 완료",
    keyReasons: [],
    risks: [],
    synthesisModel: model,
  };
}

