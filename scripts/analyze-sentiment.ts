// 감성 분석 스크립트
// 분석되지 않은 뉴스에 대해 배치 감성 분석을 수행하고 결과를 저장

import { loadEnv } from "./utils/env.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError } from "./utils/error-handler.ts";
import { batchAnalyzeSentiment, type NewsItemForAnalysis } from "./services/sentiment-analyzer.ts";

/**
 * 종목별 감성 분석 실행
 */
export async function analyzeSentimentForStock(
  supabase: ReturnType<typeof createClient<any, "public">>,
  stockId: string
): Promise<void> {
  // 1. 분석되지 않은 뉴스 조회 (필터링 완료된 것만)
  const { data: unanalyzedNews, error: fetchError } = await supabase
    .from("news_articles")
    .select("*")
    .eq("stock_id", stockId)
    .eq("analyzed", false)
    .not("filter_score", "is", null) // 필터링 완료된 것만
    .order("collected_at", { ascending: false })
    .limit(500); // 한 번에 최대 500개까지

  if (fetchError) {
    throw fetchError;
  }

  if (!unanalyzedNews || unanalyzedNews.length === 0) {
    console.log("⚠️  분석할 뉴스가 없습니다.");
    return;
  }

  console.log(`📊 분석 대상 뉴스: ${unanalyzedNews.length}개\n`);

  // 2. 배치 분석을 위한 형식으로 변환
  const newsItemsForAnalysis: NewsItemForAnalysis[] = unanalyzedNews.map((news, index) => ({
    index,
    title: news.title,
    description: news.description || undefined,
  }));

  // 3. 배치 감성 분석 실행
  const results = await batchAnalyzeSentiment(newsItemsForAnalysis, 50);

  // 4. 결과 저장
  console.log("💾 분석 결과 저장 중...\n");
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < unanalyzedNews.length; i++) {
    const news = unanalyzedNews[i];
    const result = results[i];

    if (!result) {
      console.warn(`⚠️  결과가 없습니다: ${news.title}`);
      failCount++;
      continue;
    }

    try {
      const { error: updateError } = await supabase
        .from("news_articles")
        .update({
          sentiment: result.sentiment,
          sentiment_score: result.sentimentScore,
          key_topics: result.keyTopics.length > 0 ? result.keyTopics : null,
          impact: result.impact,
          analyzed: true,
          analysis_version: "1.0",
        })
        .eq("id", news.id);

      if (updateError) {
        throw updateError;
      }

      successCount++;
    } catch (error) {
      logError(`❌ 저장 실패 (${news.title}):`, error);
      failCount++;
    }
  }

  console.log(`✨ 분석 완료: 성공 ${successCount}개, 실패 ${failCount}개`);
}

async function main() {
  console.log("📊 감성 분석 시작...\n");

  try {
    const { supabaseUrl, supabaseServiceKey } = loadEnv();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 활성화된 종목 조회
    const { data: stocks, error: stocksError } = await supabase
      .from("stocks")
      .select("id, code, name")
      .eq("is_active", true);

    if (stocksError) {
      throw stocksError;
    }

    if (!stocks || stocks.length === 0) {
      console.log("⚠️  활성화된 종목이 없습니다.");
      return;
    }

    for (const stock of stocks) {
      console.log(`\n📰 ${stock.name} (${stock.code}) 감성 분석 중...`);
      await analyzeSentimentForStock(supabase, stock.id);
    }

    console.log("\n✨ 전체 감성 분석 완료!");
  } catch (error) {
    logError("❌ 감성 분석 실패:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}

