/**
 * Fundamental Agent
 * 
 * 재무 분석 전문 Agent로 PER, PBR, ROE, 부채비율 등을 분석하여
 * 종목의 재무 건전성과 성장성을 평가합니다.
 */

import OpenAI from "openai";
import { loadEnv } from "../utils/env.ts";
import { logError } from "../utils/error-handler.ts";
import { SmartDataCollector, type FinancialData } from "../services/smart-data-collector.ts";

export interface AgentOpinion {
  recommendation: "buy" | "sell" | "hold";
  confidence: number; // 0-100
  reasoning: string[];
}

export interface FundamentalAgentResult extends AgentOpinion {
  agentName: "fundamental";
  analysis: {
    per?: number;
    pbr?: number;
    roe?: number;
    debtRatio?: number;
    evaluation: string;
  };
}

/**
 * Fundamental Agent 실행
 */
export async function runFundamentalAgent(
  stockCode: string,
  stockName: string,
  dataCollector: SmartDataCollector
): Promise<FundamentalAgentResult> {
  const { openaiApiKey } = loadEnv();
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // 재무 데이터 수집
  const financialData = await dataCollector.collectFinancialData(stockCode);

  // 프롬프트 작성
  const prompt = `당신은 한국 주식 시장의 재무 분석 전문가입니다. 다음 종목의 재무 지표를 분석하여 투자 의견을 제시하세요.

종목명: ${stockName} (${stockCode})

재무 지표:
${financialData.per !== undefined ? `- PER (주가수익비율): ${financialData.per}` : "- PER: 데이터 없음"}
${financialData.pbr !== undefined ? `- PBR (주가순자산비율): ${financialData.pbr}` : "- PBR: 데이터 없음"}
${financialData.roe !== undefined ? `- ROE (자기자본이익률): ${financialData.roe}%` : "- ROE: 데이터 없음"}
${financialData.debtRatio !== undefined ? `- 부채비율: ${financialData.debtRatio}%` : "- 부채비율: 데이터 없음"}
${financialData.currentRatio !== undefined ? `- 유동비율: ${financialData.currentRatio}` : "- 유동비율: 데이터 없음"}
${financialData.revenue !== undefined ? `- 매출액: ${financialData.revenue.toLocaleString()}원` : "- 매출액: 데이터 없음"}
${financialData.operatingProfit !== undefined ? `- 영업이익: ${financialData.operatingProfit.toLocaleString()}원` : "- 영업이익: 데이터 없음"}
${financialData.netProfit !== undefined ? `- 순이익: ${financialData.netProfit.toLocaleString()}원` : "- 순이익: 데이터 없음"}

분석 기준:
1. PER: 10-20이면 적정, 20 이상이면 고평가, 10 미만이면 저평가 가능
2. PBR: 1.0 미만이면 저평가 가능, 2.0 이상이면 고평가
3. ROE: 15% 이상이면 우수, 10% 미만이면 개선 필요
4. 부채비율: 100% 미만이면 양호, 200% 이상이면 위험
5. 유동비율: 100% 이상이면 양호, 200% 이상이면 우수

다음 JSON 형식으로 응답하세요:
{
  "recommendation": "buy" | "sell" | "hold",
  "confidence": 0-100,
  "reasoning": ["이유1", "이유2", "이유3"],
  "evaluation": "재무 지표 종합 평가 (100자 이내)"
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a financial analyst specializing in Korean stock market. Analyze financial metrics and provide investment recommendations with clear reasoning.",
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
      evaluation: string;
    };

    // 유효성 검증
    if (!["buy", "sell", "hold"].includes(parsed.recommendation)) {
      throw new Error("잘못된 recommendation 값입니다.");
    }

    const confidence = Math.max(0, Math.min(100, parsed.confidence || 50));
    const reasoning = Array.isArray(parsed.reasoning) ? parsed.reasoning : [parsed.reasoning || "분석 완료"];

    return {
      agentName: "fundamental",
      recommendation: parsed.recommendation,
      confidence,
      reasoning: reasoning.slice(0, 5), // 최대 5개
      analysis: {
        per: financialData.per,
        pbr: financialData.pbr,
        roe: financialData.roe,
        debtRatio: financialData.debtRatio,
        evaluation: parsed.evaluation || "재무 지표 분석 완료",
      },
    };
  } catch (error) {
    // 에러 발생 시 기본값 반환
    logError(`Fundamental Agent 실행 실패 (${stockName}):`, error);

    return {
      agentName: "fundamental",
      recommendation: "hold",
      confidence: 30,
      reasoning: ["재무 데이터 부족으로 분석 불가"],
      analysis: {
        per: financialData.per,
        pbr: financialData.pbr,
        roe: financialData.roe,
        debtRatio: financialData.debtRatio,
        evaluation: "데이터 부족으로 정확한 분석이 어렵습니다.",
      },
    };
  }
}

