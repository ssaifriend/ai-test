/**
 * 뉴스 원문 구조화 서비스
 * 
 * LLM을 사용하여 뉴스 원문을 구조화된 데이터로 변환합니다.
 * 원문은 저장하지 않고 요약만 저장하여 저작권 문제를 방지합니다.
 */

import OpenAI from "openai";
import { loadEnv } from "../utils/env.ts";

export interface StructuredNews {
  summary: string;
  financialNumbers: string[];
  keyFacts: string[];
  futureOutlook: string;
  impact: "high" | "medium" | "low";
}

/**
 * 뉴스 원문을 구조화된 데이터로 변환합니다.
 * 
 * @param content - 크롤링된 뉴스 본문
 * @param title - 뉴스 제목 (선택사항, 컨텍스트 제공용)
 * @returns 구조화된 뉴스 데이터
 */
export async function structureNewsContent(
  content: string,
  title?: string
): Promise<StructuredNews> {
  const { openaiApiKey } = loadEnv();
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // 본문 길이 제한 (토큰 절약)
  const truncatedContent = content.substring(0, 3000);

  const prompt = `다음 뉴스의 핵심만 추출하세요. 원문을 재생산하지 말고 요약과 구조화된 정보만 제공하세요.

${title ? `제목: ${title}\n\n` : ""}본문:
${truncatedContent}

다음 JSON 형식으로 응답하세요:
{
  "summary": "핵심 요약 (200자 이내)",
  "financialNumbers": ["재무 숫자1", "재무 숫자2"],
  "keyFacts": ["핵심 팩트1", "핵심 팩트2", "핵심 팩트3"],
  "futureOutlook": "향후 전망 (100자 이내)",
  "impact": "high" | "medium" | "low"
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a financial news analyst. Extract key information from news articles and structure it as JSON. Never reproduce the original text verbatim.",
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

    // JSON 파싱
    const parsed = JSON.parse(content) as StructuredNews;

    // 유효성 검증
    if (!parsed.summary || !parsed.impact) {
      throw new Error("필수 필드가 누락되었습니다.");
    }

    // 기본값 설정
    return {
      summary: parsed.summary || "",
      financialNumbers: Array.isArray(parsed.financialNumbers)
        ? parsed.financialNumbers
        : [],
      keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [],
      futureOutlook: parsed.futureOutlook || "",
      impact: parsed.impact || "medium",
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`JSON 파싱 실패: ${error.message}`);
    }
    if (error instanceof Error) {
      throw new Error(`구조화 실패: ${error.message}`);
    }
    throw new Error("알 수 없는 오류가 발생했습니다.");
  }
}

/**
 * 여러 뉴스 원문을 일괄 구조화합니다.
 * 
 * @param contents - 크롤링된 뉴스 본문 배열
 * @param titles - 뉴스 제목 배열 (선택사항)
 * @returns 구조화된 뉴스 데이터 배열
 */
export async function structureNewsContentBatch(
  contents: string[],
  titles?: string[]
): Promise<StructuredNews[]> {
  const results: StructuredNews[] = [];

  for (let i = 0; i < contents.length; i++) {
    try {
      const structured = await structureNewsContent(
        contents[i],
        titles?.[i]
      );
      results.push(structured);

      // API 호출 간 딜레이 (Rate Limit 방지)
      if (i < contents.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`뉴스 구조화 실패 (${i + 1}/${contents.length}):`, error);
      // 실패한 경우 기본값으로 채움
      results.push({
        summary: "",
        financialNumbers: [],
        keyFacts: [],
        futureOutlook: "",
        impact: "medium",
      });
    }
  }

  return results;
}

