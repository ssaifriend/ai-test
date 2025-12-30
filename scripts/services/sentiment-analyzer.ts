/**
 * 배치 감성 분석 서비스
 * 
 * 비용 효율적인 감성 분석을 위해 여러 뉴스를 한 번에 배치로 분석합니다.
 * 50개씩 묶어서 한 번의 API 호출로 처리하여 비용을 절감합니다.
 */

import { loadEnv } from "../utils/env.ts";
import { logError } from "../utils/error-handler.ts";

export interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number; // -1.0 ~ 1.0
  keyTopics: string[];
  impact: "high" | "medium" | "low";
}

export interface NewsItemForAnalysis {
  index: number;
  title: string;
  description?: string;
}

export interface BatchSentimentResult {
  index: number;
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  impact: "high" | "medium" | "low";
  keyTopics?: string[];
}

/**
 * 배열을 지정된 크기의 배치로 분할합니다.
 * 
 * @param array - 분할할 배열
 * @param batchSize - 배치 크기
 * @returns 배치 배열
 */
function chunk<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * 뉴스 배열을 배치로 분석합니다.
 * 
 * @param newsItems - 분석할 뉴스 아이템 배열
 * @param batchSize - 배치 크기 (기본값: 50)
 * @returns 분석 결과 배열 (원본 순서 유지)
 */
export async function batchAnalyzeSentiment(
  newsItems: NewsItemForAnalysis[],
  batchSize: number = 50
): Promise<SentimentResult[]> {
  // Edge Functions 환경에서는 Deno.env.get()로 직접 읽기
  let openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  // 로컬 실행 시에는 loadEnv()로 읽기
  if (!openaiApiKey) {
    const env = loadEnv();
    openaiApiKey = env.openaiApiKey;
  }

  // 배치로 분할
  const batches = chunk(newsItems, batchSize);
  const allResults: SentimentResult[] = new Array(newsItems.length);

  console.log(`📊 총 ${newsItems.length}개 뉴스를 ${batches.length}개 배치로 분석합니다.\n`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(`🔍 배치 ${batchIdx + 1}/${batches.length} 분석 중... (${batch.length}개)`);

    try {
      const prompt = `다음 ${batch.length}개 뉴스의 감성을 빠르게 분석하세요.

뉴스 목록:
${batch
  .map(
    (n, i) =>
      `[${n.index}] 제목: ${n.title}${n.description ? `\n   요약: ${n.description}` : ""}`
  )
  .join("\n\n")}

각 뉴스에 대해 다음 정보를 분석하세요:
- sentiment: "positive" (긍정), "negative" (부정), "neutral" (중립)
- score: 감성 점수 (-1.0 ~ 1.0, positive는 양수, negative는 음수, neutral은 0에 가까움)
- impact: "high" (높음), "medium" (보통), "low" (낮음) - 주가에 미치는 영향도
- keyTopics: 주요 키워드 배열 (최대 5개)

JSON 배열로 반환하세요:
[
  {"index": 0, "sentiment": "positive", "score": 0.8, "impact": "high", "keyTopics": ["실적", "증가"]},
  {"index": 1, "sentiment": "neutral", "score": 0.0, "impact": "low", "keyTopics": []},
  ...
]

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

      // OpenAI API 직접 호출 (Edge Functions 호환)
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a financial news sentiment analyst. Analyze sentiment of news articles and return results as a JSON array. Be concise and accurate.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API 오류: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error("LLM 응답이 비어있습니다.");
      }

      // JSON 파싱 (배열 또는 객체로 감싸진 배열)
      const parsed = JSON.parse(content);
      let results: BatchSentimentResult[];

      if (Array.isArray(parsed)) {
        results = parsed;
      } else if (parsed.results && Array.isArray(parsed.results)) {
        results = parsed.results;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        results = parsed.data;
      } else {
        // 객체의 키가 숫자인 경우
        results = Object.values(parsed) as BatchSentimentResult[];
      }

      // 결과를 원본 인덱스에 매핑
      for (const result of results) {
        const originalIndex = batch.findIndex((n) => n.index === result.index);
        if (originalIndex === -1) {
          console.warn(`⚠️  인덱스 ${result.index}를 찾을 수 없습니다.`);
          continue;
        }

        const newsItem = batch[originalIndex];
        const globalIndex = newsItems.findIndex((n) => n === newsItem);

        // 유효성 검증 및 기본값 설정
        allResults[globalIndex] = {
          sentiment: result.sentiment || "neutral",
          sentimentScore: typeof result.score === "number" ? Math.max(-1.0, Math.min(1.0, result.score)) : 0.0,
          keyTopics: Array.isArray(result.keyTopics) ? result.keyTopics.slice(0, 5) : [],
          impact: result.impact || "medium",
        };
      }

      // 누락된 항목에 대해 기본값 설정
      for (let i = 0; i < batch.length; i++) {
        const newsItem = batch[i];
        const globalIndex = newsItems.findIndex((n) => n === newsItem);
        if (!allResults[globalIndex]) {
          allResults[globalIndex] = {
            sentiment: "neutral",
            sentimentScore: 0.0,
            keyTopics: [],
            impact: "medium",
          };
        }
      }

      console.log(`  ✅ 배치 ${batchIdx + 1} 완료\n`);

      // 배치 간 딜레이 (Rate Limit 방지)
      if (batchIdx < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logError(`  ❌ 배치 ${batchIdx + 1} 분석 실패:`, error);

      // 실패한 배치의 모든 항목에 기본값 설정
      for (const newsItem of batch) {
        const globalIndex = newsItems.findIndex((n) => n === newsItem);
        allResults[globalIndex] = {
          sentiment: "neutral",
          sentimentScore: 0.0,
          keyTopics: [],
          impact: "medium",
        };
      }
    }
  }

  return allResults;
}

