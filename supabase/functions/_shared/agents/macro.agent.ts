/**
 * Macro Agent
 * 
 * 거시경제 분석 전문 Agent로 시장 전반의 거시경제 지표를 분석하여
 * 종목에 대한 거시경제적 투자 의견을 제시합니다.
 */

import { createChatCompletion } from "../utils/openai-helper.ts";
import { logError } from "../utils/error-handler.ts";
import { SmartDataCollector, type MacroData } from "../services/smart-data-collector.ts";
import type { AgentOpinion } from "./fundamental.agent.ts";

export interface MacroAgentResult extends AgentOpinion {
  agentName: "macro";
  analysis: {
    kospi?: number;
    kospiChangeRate?: number;
    kosdaq?: number;
    kosdaqChangeRate?: number;
    marketSentiment?: "bullish" | "bearish" | "neutral";
    sectorTrend?: string;
    evaluation: string;
  };
}

/**
 * Macro Agent 실행
 */
export async function runMacroAgent(
  stockName: string,
  dataCollector: SmartDataCollector,
  stockId?: string
): Promise<MacroAgentResult> {

  // 거시경제 데이터 수집
  const macroData = await dataCollector.collectMacroData();

  // 프롬프트 작성
  const prompt = `당신은 한국 주식 시장의 거시경제 분석 전문가입니다. 현재 거시경제 지표를 분석하여 ${stockName} 종목에 대한 거시경제적 투자 의견을 제시하세요.

거시경제 지표:
${macroData.kospi !== undefined ? `- KOSPI: ${macroData.kospi.toLocaleString()} (${macroData.kospiChangeRate !== undefined ? (macroData.kospiChangeRate > 0 ? '+' : '') + macroData.kospiChangeRate.toFixed(2) + '%' : '변동률 없음'})` : "- KOSPI: 데이터 없음"}
${macroData.kosdaq !== undefined ? `- KOSDAQ: ${macroData.kosdaq.toLocaleString()} (${macroData.kosdaqChangeRate !== undefined ? (macroData.kosdaqChangeRate > 0 ? '+' : '') + macroData.kosdaqChangeRate.toFixed(2) + '%' : '변동률 없음'})` : "- KOSDAQ: 데이터 없음"}
${macroData.marketSentiment !== undefined ? `- 시장 분위기: ${macroData.marketSentiment === 'bullish' ? '강세장' : macroData.marketSentiment === 'bearish' ? '약세장' : '중립'}` : ""}
${macroData.sectorTrend !== undefined ? `- 섹터 동향: ${macroData.sectorTrend}` : ""}

분석 기준:
1. 시장 지수 (KOSPI/KOSDAQ) 상승 추세면 긍정적
2. 시장 분위기가 강세장(bullish)이면 긍정적, 약세장(bearish)이면 부정적
3. 종목의 업종과 섹터 동향을 고려
4. 거시경제 전반의 흐름을 고려

다음 JSON 형식으로 응답하세요:
{
  "recommendation": "buy" | "sell" | "hold",
  "confidence": 0-100,
  "reasoning": ["이유1", "이유2", "이유3"],
  "marketTrend": "bullish" | "bearish" | "neutral",
  "evaluation": "거시경제 종합 평가 (100자 이내)"
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  try {
    const response = await createChatCompletion({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a macroeconomics analyst specializing in Korean stock market. Analyze macroeconomic indicators and provide investment recommendations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      operation: "agent",
      stock_id: stockId,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM 응답이 비어있습니다.");
    }

    const parsed = JSON.parse(content) as {
      recommendation: "buy" | "sell" | "hold";
      confidence: number;
      reasoning: string[];
      marketTrend: "bullish" | "bearish" | "neutral";
      evaluation: string;
    };

    // 유효성 검증
    if (!["buy", "sell", "hold"].includes(parsed.recommendation)) {
      throw new Error("잘못된 recommendation 값입니다.");
    }

    const confidence = Math.max(0, Math.min(100, parsed.confidence || 50));
    const reasoning = Array.isArray(parsed.reasoning) ? parsed.reasoning : [parsed.reasoning || "분석 완료"];
    const marketTrend = ["bullish", "bearish", "neutral"].includes(parsed.marketTrend)
      ? parsed.marketTrend
      : "neutral";

    return {
      agentName: "macro",
      recommendation: parsed.recommendation,
      confidence,
      reasoning: reasoning.slice(0, 5), // 최대 5개
      analysis: {
        kospi: macroData.kospi,
        kospiChangeRate: macroData.kospiChangeRate,
        kosdaq: macroData.kosdaq,
        kosdaqChangeRate: macroData.kosdaqChangeRate,
        marketSentiment: macroData.marketSentiment,
        sectorTrend: macroData.sectorTrend,
        evaluation: parsed.evaluation || "거시경제 분석 완료",
      },
    };
  } catch (error) {
    // 에러 발생 시 기본값 반환
    logError(`Macro Agent 실행 실패 (${stockName}):`, error);

    return {
      agentName: "macro",
      recommendation: "hold",
      confidence: 30,
      reasoning: ["거시경제 데이터 부족으로 분석 불가"],
      analysis: {
        kospi: macroData.kospi,
        kospiChangeRate: macroData.kospiChangeRate,
        kosdaq: macroData.kosdaq,
        kosdaqChangeRate: macroData.kosdaqChangeRate,
        marketSentiment: macroData.marketSentiment,
        sectorTrend: macroData.sectorTrend,
        evaluation: "거시경제 데이터가 부족하여 정확한 분석이 어렵습니다.",
      },
    };
  }
}

