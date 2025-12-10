/**
 * Macro Agent
 * 
 * 거시경제 분석 전문 Agent로 시장 전반의 거시경제 지표를 분석하여
 * 종목에 대한 거시경제적 투자 의견을 제시합니다.
 */

import OpenAI from "openai";
import { loadEnv } from "../utils/env.ts";
import { SmartDataCollector, type MacroData } from "../services/smart-data-collector.ts";
import type { AgentOpinion } from "./fundamental.agent.ts";

export interface MacroAgentResult extends AgentOpinion {
  agentName: "macro";
  analysis: {
    kospi?: number;
    kosdaq?: number;
    usdKrw?: number;
    interestRate?: number;
    marketTrend: "bullish" | "bearish" | "neutral";
    evaluation: string;
  };
}

/**
 * Macro Agent 실행
 */
export async function runMacroAgent(
  stockName: string,
  dataCollector: SmartDataCollector
): Promise<MacroAgentResult> {
  const { openaiApiKey } = loadEnv();
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // 거시경제 데이터 수집
  const macroData = await dataCollector.collectMacroData();

  // 프롬프트 작성
  const prompt = `당신은 한국 주식 시장의 거시경제 분석 전문가입니다. 현재 거시경제 지표를 분석하여 ${stockName} 종목에 대한 거시경제적 투자 의견을 제시하세요.

거시경제 지표:
${macroData.kospi !== undefined ? `- KOSPI: ${macroData.kospi.toLocaleString()}` : "- KOSPI: 데이터 없음"}
${macroData.kosdaq !== undefined ? `- KOSDAQ: ${macroData.kosdaq.toLocaleString()}` : "- KOSDAQ: 데이터 없음"}
${macroData.usdKrw !== undefined ? `- USD/KRW: ${macroData.usdKrw.toLocaleString()}원` : "- USD/KRW: 데이터 없음"}
${macroData.interestRate !== undefined ? `- 기준금리: ${macroData.interestRate}%` : "- 기준금리: 데이터 없음"}

분석 기준:
1. 시장 지수 (KOSPI/KOSDAQ) 상승 추세면 긍정적
2. 환율 상승은 수출 기업에 긍정적, 내수 기업에 부정적
3. 금리 상승은 주식 시장에 부정적
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
    const response = await openai.chat.completions.create({
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
        kosdaq: macroData.kosdaq,
        usdKrw: macroData.usdKrw,
        interestRate: macroData.interestRate,
        marketTrend,
        evaluation: parsed.evaluation || "거시경제 분석 완료",
      },
    };
  } catch (error) {
    // 에러 발생 시 기본값 반환
    console.error(`Macro Agent 실행 실패 (${stockName}):`, error instanceof Error ? error.message : String(error));

    return {
      agentName: "macro",
      recommendation: "hold",
      confidence: 30,
      reasoning: ["거시경제 데이터 부족으로 분석 불가"],
      analysis: {
        kospi: macroData.kospi,
        kosdaq: macroData.kosdaq,
        usdKrw: macroData.usdKrw,
        interestRate: macroData.interestRate,
        marketTrend: "neutral",
        evaluation: "거시경제 데이터가 부족하여 정확한 분석이 어렵습니다.",
      },
    };
  }
}

