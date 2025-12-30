// 원문 수집 및 구조화 스크립트
// 필터링을 통과한 뉴스 중 중요도가 높은 뉴스의 원문을 수집하고 구조화

import { loadEnv } from "./utils/env.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError } from "./utils/error-handler.ts";
import { classifyImportance } from "./utils/importance-classifier.ts";
import { crawlNewsContent } from "./services/news-crawler.ts";
import { structureNewsContent } from "./services/news-structurizer.ts";

/**
 * 시간대별 중요도 임계값
 */
const IMPORTANCE_THRESHOLDS = {
  peak: 0.15, // 15% (15개 중 약 2-3개)
  active: 0.10, // 10%
  off: 0.05, // 5%
} as const;

/**
 * 현재 시간대 판단
 */
function getCurrentTimePeriod(): "peak" | "active" | "off" {
  const now = new Date();
  const hour = now.getHours(); // UTC 시간

  // 한국 시간 기준 (UTC+9)
  const kstHour = (hour + 9) % 24;

  if (kstHour >= 9 && kstHour < 15) {
    return "peak"; // 09:00-15:00 KST
  } else if ((kstHour >= 8 && kstHour < 9) || (kstHour >= 15 && kstHour < 20)) {
    return "active"; // 08:00-09:00, 15:00-20:00 KST
  } else {
    return "off"; // 그 외 시간
  }
}

/**
 * 종목별 원문 수집 및 구조화
 */
export async function collectFullContentForStock(
  supabase: ReturnType<typeof createClient<any, "public">>,
  stockId: string,
  timePeriod: "peak" | "active" | "off"
): Promise<void> {
  // 1. 필터링을 통과했지만 원문이 없는 뉴스 조회
  const { data: filteredNews, error: fetchError } = await supabase
    .from("news_articles")
    .select("*")
    .eq("stock_id", stockId)
    .eq("has_full_content", false)
    .not("filter_score", "is", null) // 필터링 완료된 것만
    .is("importance", null) // 중요도 미분류
    .order("collected_at", { ascending: false })
    .limit(100);

  if (fetchError) {
    throw fetchError;
  }

  if (!filteredNews || filteredNews.length === 0) {
    console.log("⚠️  원문 수집 대상 뉴스가 없습니다.");
    return;
  }

  console.log(`📊 필터링된 뉴스: ${filteredNews.length}개\n`);

  // 2. 중요도 분류
  console.log("🔍 중요도 분류 중...");
  const importanceMap = new Map<string, "high" | "medium" | "low">();

  for (const news of filteredNews) {
    const importance = classifyImportance({
      title: news.title,
      description: news.description || "",
    });
    importanceMap.set(news.id, importance);
  }

  const highImportance = filteredNews.filter((n) => importanceMap.get(n.id) === "high");
  const mediumImportance = filteredNews.filter((n) => importanceMap.get(n.id) === "medium");
  const lowImportance = filteredNews.filter((n) => importanceMap.get(n.id) === "low");

  console.log(`  ✅ High: ${highImportance.length}개, Medium: ${mediumImportance.length}개, Low: ${lowImportance.length}개`);

  // 3. 시간대별 임계값 적용하여 원문 수집 대상 선정
  const threshold = IMPORTANCE_THRESHOLDS[timePeriod];
  const targetCount = Math.ceil(filteredNews.length * threshold);

  // High 우선, 부족하면 Medium에서 보충
  const targetNews = [
    ...highImportance.slice(0, targetCount),
    ...(highImportance.length < targetCount
      ? mediumImportance.slice(0, targetCount - highImportance.length)
      : []),
  ];

  console.log(`\n📥 원문 수집 대상: ${targetNews.length}개 (임계값: ${(threshold * 100).toFixed(0)}%)\n`);

  if (targetNews.length === 0) {
    // 중요도만 업데이트하고 종료
    for (const news of filteredNews) {
      await supabase
        .from("news_articles")
        .update({ importance: importanceMap.get(news.id) })
        .eq("id", news.id);
    }
    return;
  }

  // 4. 원문 크롤링 및 구조화
  let successCount = 0;
  let failCount = 0;

  for (const news of targetNews) {
    if (!news.url) {
      console.log(`⚠️  URL이 없어 스킵: ${news.title}`);
      failCount++;
      continue;
    }

    try {
      console.log(`🔍 크롤링 중: ${news.title.substring(0, 50)}...`);

      // 원문 크롤링
      const crawled = await crawlNewsContent(news.url);

      if (!crawled.success || !crawled.content) {
        console.log(`  ❌ 크롤링 실패: ${crawled.error || "알 수 없는 오류"}`);
        failCount++;
        continue;
      }

      // LLM 구조화
      const structured = await structureNewsContent(crawled.content, news.title);

      // 데이터베이스 업데이트
      const { error: updateError } = await supabase
        .from("news_articles")
        .update({
          importance: importanceMap.get(news.id),
          has_full_content: true,
          full_content_summary: structured.summary,
          financial_numbers: structured.financialNumbers,
          key_facts: structured.keyFacts,
          future_outlook: structured.futureOutlook,
        })
        .eq("id", news.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`  ✅ 완료: ${structured.summary.substring(0, 50)}...`);
      successCount++;

      // API 호출 간 딜레이 (Rate Limit 방지)
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      logError(`  ❌ 처리 실패:`, error);
      failCount++;
    }
  }

  // 5. 나머지 뉴스의 중요도만 업데이트
  const remainingNews = filteredNews.filter((n) => !targetNews.some((t) => t.id === n.id));
  for (const news of remainingNews) {
    await supabase
      .from("news_articles")
      .update({ importance: importanceMap.get(news.id) })
      .eq("id", news.id);
  }

  console.log(`\n✨ 원문 수집 완료: 성공 ${successCount}개, 실패 ${failCount}개`);
}

async function main() {
  console.log("📥 원문 수집 및 구조화 시작...\n");

  try {
    const { supabaseUrl, supabaseServiceKey } = loadEnv();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 현재 시간대 판단
    const timePeriod = getCurrentTimePeriod();
    console.log(`⏰ 현재 시간대: ${timePeriod} (임계값: ${(IMPORTANCE_THRESHOLDS[timePeriod] * 100).toFixed(0)}%)\n`);

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
      console.log(`\n📰 ${stock.name} (${stock.code}) 원문 수집 중...`);
      await collectFullContentForStock(supabase, stock.id, timePeriod);
    }

    console.log("\n✨ 전체 원문 수집 완료!");
  } catch (error) {
    logError("❌ 원문 수집 실패:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}

