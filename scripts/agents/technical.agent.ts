/**
 * Technical Agent
 * 
 * 기술적 분석 전문 Agent로 이동평균, RSI, MACD 등을 분석하여
 * 종목의 기술적 추세와 매매 타이밍을 평가합니다.
 */

import OpenAI from "openai";
import { loadEnv } from "../utils/env.ts";
import { logError } from "../utils/error-handler.ts";
import { SmartDataCollector, type TechnicalData } from "../services/smart-data-collector.ts";
import type { AgentOpinion } from "./fundamental.agent.ts";

export interface TechnicalAgentResult extends AgentOpinion {
  agentName: "technical";
  analysis: {
    price: number;
    ma5?: number;
    ma20?: number;
    ma60?: number;
    rsi?: number;
    macd?: number;
    trend: "bullish" | "bearish" | "neutral";
    evaluation: string;
  };
}

/**
 * Technical Agent 실행
 */
export async function runTechnicalAgent(
  stockCode: string,
  stockName: string,
  dataCollector: SmartDataCollector
): Promise<TechnicalAgentResult> {
  const { openaiApiKey } = loadEnv();
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // 기술적 지표 수집
  const technicalData = await dataCollector.collectTechnicalData(stockCode);

  // 프롬프트 작성
  const prompt = `당신은 한국 주식 시장의 기술적 분석 전문가입니다. 다음 종목의 기술적 지표를 분석하여 투자 의견을 제시하세요.

종목명: ${stockName} (${stockCode})

기술적 지표:
${technicalData.price > 0 ? `- 현재가: ${technicalData.price.toLocaleString()}원` : "- 현재가: 데이터 없음"}
${technicalData.ma5 !== undefined ? `- 5일 이동평균: ${technicalData.ma5.toLocaleString()}원` : "- 5일 이동평균: 데이터 없음"}
${technicalData.ma20 !== undefined ? `- 20일 이동평균: ${technicalData.ma20.toLocaleString()}원` : "- 20일 이동평균: 데이터 없음"}
${technicalData.ma60 !== undefined ? `- 60일 이동평균: ${technicalData.ma60.toLocaleString()}원` : "- 60일 이동평균: 데이터 없음"}
${technicalData.rsi !== undefined ? `- RSI: ${technicalData.rsi}` : "- RSI: 데이터 없음"}
${technicalData.macd !== undefined ? `- MACD: ${technicalData.macd}` : "- MACD: 데이터 없음"}
${technicalData.volume !== undefined ? `- 거래량: ${technicalData.volume.toLocaleString()}` : "- 거래량: 데이터 없음"}

분석 기준:
1. 이동평균선: 현재가가 이동평균선 위에 있으면 상승 추세, 아래에 있으면 하락 추세
2. RSI: 70 이상이면 과매수, 30 미만이면 과매도
3. MACD: MACD선이 신호선을 상향 돌파하면 매수 신호, 하향 돌파하면 매도 신호
4. 거래량: 평균 대비 증가하면 관심도 상승

다음 JSON 형식으로 응답하세요:
{
  "recommendation": "buy" | "sell" | "hold",
  "confidence": 0-100,
  "reasoning": ["이유1", "이유2", "이유3"],
  "trend": "bullish" | "bearish" | "neutral",
  "evaluation": "기술적 지표 종합 평가 (100자 이내)"
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a technical analyst specializing in Korean stock market. Analyze technical indicators and provide trading recommendations with clear reasoning.",
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
      trend: "bullish" | "bearish" | "neutral";
      evaluation: string;
    };

    // 유효성 검증
    if (!["buy", "sell", "hold"].includes(parsed.recommendation)) {
      throw new Error("잘못된 recommendation 값입니다.");
    }

    const confidence = Math.max(0, Math.min(100, parsed.confidence || 50));
    const reasoning = Array.isArray(parsed.reasoning) ? parsed.reasoning : [parsed.reasoning || "분석 완료"];
    const trend = ["bullish", "bearish", "neutral"].includes(parsed.trend) ? parsed.trend : "neutral";

    return {
      agentName: "technical",
      recommendation: parsed.recommendation,
      confidence,
      reasoning: reasoning.slice(0, 5), // 최대 5개
      analysis: {
        price: technicalData.price,
        ma5: technicalData.ma5,
        ma20: technicalData.ma20,
        ma60: technicalData.ma60,
        rsi: technicalData.rsi,
        macd: technicalData.macd,
        trend,
        evaluation: parsed.evaluation || "기술적 지표 분석 완료",
      },
    };
  } catch (error) {
    // 에러 발생 시 기본값 반환
    logError(`Technical Agent 실행 실패 (${stockName}):`, error);

    return {
      agentName: "technical",
      recommendation: "hold",
      confidence: 30,
      reasoning: ["기술적 지표 데이터 부족으로 분석 불가"],
      analysis: {
        price: technicalData.price,
        ma5: technicalData.ma5,
        ma20: technicalData.ma20,
        ma60: technicalData.ma60,
        rsi: technicalData.rsi,
        macd: technicalData.macd,
        trend: "neutral",
        evaluation: "데이터 부족으로 정확한 분석이 어렵습니다.",
      },
    };
  }
}

