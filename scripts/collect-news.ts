// 뉴스 수집 스크립트
// Naver News API를 사용하여 종목별 뉴스를 수집하고 Supabase에 저장

import { loadEnv } from "./utils/env.ts";
import { createClient } from "supabase";
import type { NewsItem, NaverNewsResponse, NewsArticle } from "./types.ts";

async function collectNewsForStock(
  supabase: ReturnType<typeof createClient>,
  stockCode: string,
  stockId: string,
  stockName: string,
  display: number = 50
): Promise<number> {
  const { naverClientId, naverClientSecret } = loadEnv();

  const query = encodeURIComponent(stockName);
  const url = `https://openapi.naver.com/v1/search/news.json?query=${query}&display=${display}&sort=date`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": naverClientId,
        "X-Naver-Client-Secret": naverClientSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
    }

    const data: NaverNewsResponse = await response.json();
    let savedCount = 0;

    for (const item of data.items) {
      // 중복 체크 (stock_id, url 기준)
      const { data: existing } = await supabase
        .from("news_articles")
        .select("id")
        .eq("stock_id", stockId)
        .eq("url", item.link)
        .single();

      if (existing) {
        continue; // 이미 존재하는 뉴스는 스킵
      }

      // 뉴스 기사 저장
      const newsArticle: Omit<NewsArticle, "id"> = {
        stock_id: stockId,
        title: item.title.replace(/<[^>]*>/g, ""), // HTML 태그 제거
        description: item.description?.replace(/<[^>]*>/g, ""),
        url: item.link,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
        collected_at: new Date().toISOString(),
        has_full_content: false,
        analyzed: false,
      };

      const { error } = await supabase.from("news_articles").insert(newsArticle);

      if (error) {
        console.error(`뉴스 저장 실패 (${item.title}):`, error.message);
        continue;
      }

      savedCount++;
    }

    return savedCount;
  } catch (error) {
    console.error(`뉴스 수집 실패 (${stockName}):`, error instanceof Error ? error.message : String(error));
    return 0;
  }
}

async function main() {
  console.log("📰 뉴스 수집 시작...\n");

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

    console.log(`📊 수집 대상 종목: ${stocks.length}개\n`);

    let totalSaved = 0;

    for (const stock of stocks) {
      console.log(`🔍 ${stock.name} (${stock.code}) 뉴스 수집 중...`);
      const saved = await collectNewsForStock(supabase, stock.code, stock.id, stock.name);
      console.log(`  ✅ ${saved}개 뉴스 저장 완료\n`);
      totalSaved += saved;
    }

    console.log(`\n✨ 전체 수집 완료: ${totalSaved}개 뉴스 저장`);
  } catch (error) {
    console.error("❌ 뉴스 수집 실패:");
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}

