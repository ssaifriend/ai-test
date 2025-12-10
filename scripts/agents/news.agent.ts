/**
 * News Agent
 * 
 * 뉴스 감성 분석 전문 Agent로 최근 뉴스의 감성과 트렌드를 분석하여
 * 종목에 대한 뉴스 기반 투자 의견을 제시합니다.
 */

import OpenAI from "openai";
import { loadEnv } from "../utils/env.ts";
import { logError } from "../utils/error-handler.ts";
import { SmartDataCollector, type NewsData } from "../services/smart-data-collector.ts";
import type { AgentOpinion } from "./fundamental.agent.ts";

export interface NewsAgentResult extends AgentOpinion {
  agentName: "news";
  analysis: {
    recentNewsCount: number;
    sentimentTrend: {
      positive: number;
      negative: number;
      neutral: number;
    };
    keyTopics: string[];
    evaluation: string;
  };
}

/**
 * News Agent 실행
 */
export async function runNewsAgent(
  stockId: string,
  stockName: string,
  dataCollector: SmartDataCollector
): Promise<NewsAgentResult> {
  const { openaiApiKey } = loadEnv();
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // 뉴스 데이터 수집
  const newsData = await dataCollector.collectNewsData(stockId, 20);

  // 프롬프트 작성
  const recentNewsSummary = newsData.recentNews
    .slice(0, 10)
    .map((n, i) => `[${i + 1}] ${n.title} (${n.sentiment}, 영향도: ${n.impact})`)
    .join("\n");

  const prompt = `당신은 한국 주식 시장의 뉴스 분석 전문가입니다. 다음 종목의 최근 뉴스 감성과 트렌드를 분석하여 투자 의견을 제시하세요.

종목명: ${stockName}

최근 뉴스 (${newsData.recentNews.length}개):
${recentNewsSummary || "최근 뉴스 없음"}

감성 트렌드:
- 긍정: ${newsData.sentimentTrend.positive}개
- 부정: ${newsData.sentimentTrend.negative}개
- 중립: ${newsData.sentimentTrend.neutral}개

분석 기준:
1. 긍정 뉴스가 많고 영향도가 높으면 매수 신호
2. 부정 뉴스가 많고 영향도가 높으면 매도 신호
3. 중립 뉴스가 많거나 뉴스가 적으면 보유
4. 최근 트렌드 변화에 주목

다음 JSON 형식으로 응답하세요:
{
  "recommendation": "buy" | "sell" | "hold",
  "confidence": 0-100,
  "reasoning": ["이유1", "이유2", "이유3"],
  "keyTopics": ["주요 키워드1", "주요 키워드2"],
  "evaluation": "뉴스 감성 종합 평가 (100자 이내)"
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a news sentiment analyst specializing in Korean stock market. Analyze news sentiment and trends to provide investment recommendations.",
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
      keyTopics: string[];
      evaluation: string;
    };

    // 유효성 검증
    if (!["buy", "sell", "hold"].includes(parsed.recommendation)) {
      throw new Error("잘못된 recommendation 값입니다.");
    }

    const confidence = Math.max(0, Math.min(100, parsed.confidence || 50));
    const reasoning = Array.isArray(parsed.reasoning) ? parsed.reasoning : [parsed.reasoning || "분석 완료"];
    const keyTopics = Array.isArray(parsed.keyTopics) ? parsed.keyTopics.slice(0, 5) : [];

    return {
      agentName: "news",
      recommendation: parsed.recommendation,
      confidence,
      reasoning: reasoning.slice(0, 5), // 최대 5개
      analysis: {
        recentNewsCount: newsData.recentNews.length,
        sentimentTrend: newsData.sentimentTrend,
        keyTopics,
        evaluation: parsed.evaluation || "뉴스 감성 분석 완료",
      },
    };
  } catch (error) {
    // 에러 발생 시 기본값 반환
    logError(`News Agent 실행 실패 (${stockName}):`, error);

    return {
      agentName: "news",
      recommendation: "hold",
      confidence: 30,
      reasoning: ["뉴스 데이터 부족으로 분석 불가"],
      analysis: {
        recentNewsCount: newsData.recentNews.length,
        sentimentTrend: newsData.sentimentTrend,
        keyTopics: [],
        evaluation: "뉴스 데이터가 부족하여 정확한 분석이 어렵습니다.",
      },
    };
  }
}

