// Supabase Edge Function: 원문 수집 및 구조화
// 필터링을 통과한 뉴스 중 중요도가 높은 뉴스의 원문을 수집하고 구조화

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { classifyImportance } from "../_shared/utils/importance-classifier.ts";
import { crawlNewsContent } from "../_shared/services/news-crawler.ts";
import { structureNewsContent } from "../_shared/services/news-structurizer.ts";
import { logError } from "../_shared/utils/error-handler.ts";

/**
 * 시간대별 중요도 임계값
 */
const IMPORTANCE_THRESHOLDS = {
  peak: 0.50, // 50%
  active: 0.40, // 40%
  off: 0.30, // 30%
} as const;

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    if (!supabaseUrl || !supabaseServiceRoleKey || !openaiApiKey) {
      throw new Error("필수 환경 변수가 설정되지 않았습니다.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 현재 시간대 판단
    const now = new Date();
    const hour = now.getHours();
    let timePeriod: "peak" | "active" | "off" = "off";

    if (hour >= 9 && hour < 15) {
      timePeriod = "peak";
    } else if ((hour >= 8 && hour < 9) || (hour >= 15 && hour < 20)) {
      timePeriod = "active";
    }

    // 활성화된 종목 조회
    const { data: stocks, error: stocksError } = await supabase
      .from("stocks")
      .select("id, code, name")
      .eq("is_active", true);

    if (stocksError) {
      throw stocksError;
    }

    if (!stocks || stocks.length === 0) {
      return new Response(
        JSON.stringify({ message: "활성화된 종목이 없습니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let totalProcessed = 0;

    for (const stock of stocks) {
      // 필터링을 통과했지만 원문이 없는 뉴스 조회
      const { data: filteredNews, error: fetchError } = await supabase
        .from("news_articles")
        .select("*")
        .eq("stock_id", stock.id)
        .eq("has_full_content", false)
        .not("filter_score", "is", null)
        .is("importance", null)
        .order("collected_at", { ascending: false })
        .limit(200);

      if (fetchError || !filteredNews || filteredNews.length === 0) {
        continue;
      }

      // 중요도 분류
      const importanceMap = new Map<string, "high" | "medium" | "low">();

      for (const news of filteredNews) {
        const importance = classifyImportance({
          title: news.title,
          description: news.description || "",
        });
        importanceMap.set(news.id, importance);
      }

      // 시간대별 임계값 적용
      const threshold = IMPORTANCE_THRESHOLDS[timePeriod];
      const highImportance = filteredNews.filter((n) => importanceMap.get(n.id) === "high");
      const mediumImportance = filteredNews.filter((n) => importanceMap.get(n.id) === "medium");
      const targetCount = Math.ceil(filteredNews.length * threshold);

      const targetNews = [
        ...highImportance,
        ...mediumImportance.slice(0, Math.max(0, targetCount - highImportance.length)),
      ];

      // 원문 수집 (간소화된 버전)
      for (const news of targetNews.slice(0, 20)) { // 최대 20개로 제한
        if (!news.url) continue;

        try {
          // 중복 체크
          const { data: existing } = await supabase
            .from("news_articles")
            .select("full_content_summary")
            .eq("url", news.url)
            .eq("has_full_content", true)
            .single();

          if (existing?.full_content_summary) {
            // 재사용
            await supabase
              .from("news_articles")
              .update({
                importance: importanceMap.get(news.id),
                has_full_content: true,
                full_content_summary: existing.full_content_summary,
              })
              .eq("id", news.id);
            totalProcessed++;
            continue;
          }

          // 새로 크롤링
          const crawled = await crawlNewsContent(news.url);
          if (!crawled.success || !crawled.content) continue;

          const structured = await structureNewsContent(crawled.content, news.title);

          await supabase
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

          totalProcessed++;
        } catch (error) {
          logError(`원문 수집 실패:`, error);
        }
      }

      // 나머지는 중요도만 업데이트
      const remaining = filteredNews.filter((n) => !targetNews.some((t) => t.id === n.id));
      for (const news of remaining) {
        await supabase
          .from("news_articles")
          .update({ importance: importanceMap.get(news.id) })
          .eq("id", news.id);
      }
    }

    return new Response(
      JSON.stringify({ message: "원문 수집 완료", processed: totalProcessed, stocks: stocks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("원문 수집 오류:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
