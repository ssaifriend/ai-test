/**
 * Risk Agent
 * 
 * 리스크 관리 전문 Agent로 종목의 리스크 수준을 분석하여
 * 투자 시 고려해야 할 리스크 요소를 평가합니다.
 */

import OpenAI from "openai";
import { loadEnv } from "../utils/env.ts";
import { logError } from "../utils/error-handler.ts";
import { SmartDataCollector, type RiskData } from "../services/smart-data-collector.ts";
import type { AgentOpinion } from "./fundamental.agent.ts";

export interface RiskAgentResult extends AgentOpinion {
  agentName: "risk";
  analysis: {
    volatility?: number;
    beta?: number;
    maxDrawdown?: number;
    riskLevel: "low" | "medium" | "high";
    riskFactors: string[];
    evaluation: string;
  };
}

/**
 * Risk Agent 실행
 */
export async function runRiskAgent(
  stockCode: string,
  stockName: string,
  dataCollector: SmartDataCollector
): Promise<RiskAgentResult> {
  const { openaiApiKey } = loadEnv();
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // 리스크 데이터 수집
  const riskData = await dataCollector.collectRiskData(stockCode);

  // 프롬프트 작성
  const prompt = `당신은 한국 주식 시장의 리스크 관리 전문가입니다. 다음 종목의 리스크 수준을 분석하여 투자 의견을 제시하세요.

종목명: ${stockName} (${stockCode})

리스크 지표:
${riskData.volatility !== undefined ? `- 변동성: ${riskData.volatility}%` : "- 변동성: 데이터 없음"}
${riskData.beta !== undefined ? `- 베타: ${riskData.beta}` : "- 베타: 데이터 없음"}
${riskData.maxDrawdown !== undefined ? `- 최대 낙폭: ${riskData.maxDrawdown}%` : "- 최대 낙폭: 데이터 없음"}
- 리스크 수준: ${riskData.riskLevel}

분석 기준:
1. 변동성: 20% 이상이면 고위험, 10% 미만이면 저위험
2. 베타: 1.0보다 크면 시장보다 변동성 큼, 작으면 변동성 작음
3. 최대 낙폭: 30% 이상이면 고위험
4. 리스크 수준이 높으면 매도 또는 보유, 낮으면 매수 고려

다음 JSON 형식으로 응답하세요:
{
  "recommendation": "buy" | "sell" | "hold",
  "confidence": 0-100,
  "reasoning": ["이유1", "이유2", "이유3"],
  "riskFactors": ["리스크 요소1", "리스크 요소2"],
  "evaluation": "리스크 종합 평가 (100자 이내)"
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a risk management analyst specializing in Korean stock market. Analyze risk factors and provide investment recommendations with risk considerations.",
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
      riskFactors: string[];
      evaluation: string;
    };

    // 유효성 검증
    if (!["buy", "sell", "hold"].includes(parsed.recommendation)) {
      throw new Error("잘못된 recommendation 값입니다.");
    }

    const confidence = Math.max(0, Math.min(100, parsed.confidence || 50));
    const reasoning = Array.isArray(parsed.reasoning) ? parsed.reasoning : [parsed.reasoning || "분석 완료"];
    const riskFactors = Array.isArray(parsed.riskFactors) ? parsed.riskFactors.slice(0, 5) : [];

    return {
      agentName: "risk",
      recommendation: parsed.recommendation,
      confidence,
      reasoning: reasoning.slice(0, 5), // 최대 5개
      analysis: {
        volatility: riskData.volatility,
        beta: riskData.beta,
        maxDrawdown: riskData.maxDrawdown,
        riskLevel: riskData.riskLevel,
        riskFactors,
        evaluation: parsed.evaluation || "리스크 분석 완료",
      },
    };
  } catch (error) {
    // 에러 발생 시 기본값 반환
    logError(`Risk Agent 실행 실패 (${stockName}):`, error);

    return {
      agentName: "risk",
      recommendation: "hold",
      confidence: 30,
      reasoning: ["리스크 데이터 부족으로 분석 불가"],
      analysis: {
        volatility: riskData.volatility,
        beta: riskData.beta,
        maxDrawdown: riskData.maxDrawdown,
        riskLevel: riskData.riskLevel,
        riskFactors: [],
        evaluation: "리스크 데이터가 부족하여 정확한 분석이 어렵습니다.",
      },
    };
  }
}

