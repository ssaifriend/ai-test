// 필터링 파이프라인 통합 스크립트
// 수집된 뉴스에 필터링을 적용하고 통계를 수집

import { loadEnv } from "./utils/env.ts";
import { createClient } from "supabase";
import { filterBySource } from "./utils/source-filter.ts";
import { removeDuplicates } from "./utils/deduplication.ts";
import { filterClickbaitAndLowQuality } from "./utils/clickbait-detector.ts";
import type { NewsArticle } from "./types.ts";

/**
 * 필터링 파이프라인 실행
 */
async function runFilteringPipeline(
  supabase: ReturnType<typeof createClient>,
  stockId: string,
  timePeriod: "peak" | "active" | "off"
): Promise<void> {
  // 1. 미필터링 뉴스 조회 (최근 수집된 것)
  const { data: rawNews, error: fetchError } = await supabase
    .from("news_articles")
    .select("*")
    .eq("stock_id", stockId)
    .is("filter_score", null)
    .order("collected_at", { ascending: false })
    .limit(1000);

  if (fetchError) {
    throw fetchError;
  }

  if (!rawNews || rawNews.length === 0) {
    console.log("⚠️  필터링할 뉴스가 없습니다.");
    return;
  }

  console.log(`📊 원본 뉴스: ${rawNews.length}개\n`);

  // 2. 언론사 필터
  console.log("🔍 언론사 필터 적용 중...");
  const { passed: afterSourceFilter, stats: sourceStats } = filterBySource(rawNews);
  console.log(`  ✅ 통과: ${sourceStats.passed}개, 제거: ${sourceStats.filtered}개`);

  // 3. 중복 제거
  console.log("\n🔍 중복 제거 적용 중...");
  const { unique: afterDedup, stats: dedupStats } = removeDuplicates(afterSourceFilter);
  console.log(`  ✅ 고유: ${dedupStats.unique}개, 중복: ${dedupStats.duplicates}개`);
  console.log(`  📈 평균 유사도: ${dedupStats.avgSimilarity}`);

  // 4. 클릭베이트 및 저품질 필터
  console.log("\n🔍 클릭베이트 및 저품질 필터 적용 중...");
  const { passed: finalNews, stats: qualityStats } = filterClickbaitAndLowQuality(afterDedup);
  console.log(`  ✅ 통과: ${qualityStats.passed}개, 제거: ${qualityStats.filtered}개`);
  console.log(`  📊 클릭베이트: ${qualityStats.clickbait}개, 저품질: ${qualityStats.lowQuality}개`);

  // 5. 필터링 결과 업데이트
  console.log("\n💾 필터링 결과 저장 중...");
  const filterRate = rawNews.length > 0 ? ((rawNews.length - finalNews.length) / rawNews.length) * 100 : 0;

  for (const news of finalNews) {
    const filterScore = calculateFilterScore(news, sourceStatsWithTier, dedupStats);
    await supabase
      .from("news_articles")
      .update({
        filter_score: filterScore,
      })
      .eq("id", news.id);
  }

  // 6. 필터링 통계 저장
  await supabase.from("filtering_stats").insert({
    stock_id: stockId,
    time_period: timePeriod,
    raw_count: rawNews.length,
    after_source_filter: sourceStats.passed,
    after_dedup: dedupStats.unique,
    after_quality_filter: qualityStats.passed,
    final_count: finalNews.length,
    high_importance_count: 0, // 중요도 분류는 나중에
    filter_rate: Math.round(filterRate * 100) / 100,
    avg_similarity: dedupStats.avgSimilarity,
  });

  console.log("\n✨ 필터링 완료!");
  console.log(`📊 최종 통과율: ${((finalNews.length / rawNews.length) * 100).toFixed(1)}%`);
}

/**
 * 필터 점수 계산 (0.0 ~ 1.0)
 */
function calculateFilterScore(
  news: NewsArticle,
  sourceStats: { tier1: number; tier2: number; tier3: number },
  dedupStats: { avgSimilarity: number }
): number {
  let score = 0.5; // 기본 점수

  // 언론사 tier에 따른 점수 조정
  if (news.source) {
    // tier는 source-filter에서 확인 필요하지만, 여기서는 간단히 처리
    score += 0.2; // 화이트리스트 통과 시 보너스
  }

  // 설명 길이에 따른 점수
  if (news.description && news.description.length > 100) {
    score += 0.1;
  }

  // 제목 길이 적절성
  if (news.title.length >= 20 && news.title.length <= 100) {
    score += 0.1;
  }

  return Math.min(1.0, Math.max(0.0, score));
}

async function main() {
  console.log("🔍 필터링 파이프라인 시작...\n");

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

    // 현재 시간대 판단 (간단한 버전)
    const now = new Date();
    const hour = now.getHours();
    let timePeriod: "peak" | "active" | "off" = "off";

    if (hour >= 9 && hour < 15) {
      timePeriod = "peak";
    } else if ((hour >= 8 && hour < 9) || (hour >= 15 && hour < 20)) {
      timePeriod = "active";
    }

    for (const stock of stocks) {
      console.log(`\n📰 ${stock.name} (${stock.code}) 필터링 중...`);
      await runFilteringPipeline(supabase, stock.id, timePeriod);
    }

    console.log("\n✨ 전체 필터링 완료!");
  } catch (error) {
    console.error("❌ 필터링 실패:");
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}

