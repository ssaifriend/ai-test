// Supabase Edge Function: 감성 분석
// 분석되지 않은 뉴스에 대해 배치 감성 분석을 수행하고 결과를 저장

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { analyzeSentimentForStock } from "../../../scripts/analyze-sentiment.ts";

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

    let totalMediumOrHighNews = 0;

    for (const stock of stocks) {
      await analyzeSentimentForStock(supabase, stock.id);

      // 최근 1시간 이내 medium 이상 importance 뉴스 개수 확인
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: importantNews, error: newsError } = await supabase
        .from("news_articles")
        .select("id", { count: "exact" })
        .eq("stock_id", stock.id)
        .in("importance", ["medium", "high"])
        .gte("collected_at", oneHourAgo);

      if (!newsError && importantNews) {
        totalMediumOrHighNews += importantNews.length;
      }
    }

    // medium 이상 뉴스가 1개 이상이면 Multi-Agent 분석 트리거
    if (totalMediumOrHighNews >= 1) {
      const githubToken = Deno.env.get("GITHUB_TOKEN");
      const githubRepo = Deno.env.get("GITHUB_REPOSITORY") || "ssaifriend/ai-test";

      if (githubToken) {
        try {
          await fetch(`https://api.github.com/repos/${githubRepo}/dispatches`, {
            method: "POST",
            headers: {
              "Accept": "application/vnd.github+json",
              "Authorization": `Bearer ${githubToken}`,
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({
              event_type: "news-trigger",
              client_payload: {
                important_news_count: totalMediumOrHighNews,
              },
            }),
          });
          console.log(`✅ Multi-Agent 분석 트리거 (중요 뉴스 ${totalMediumOrHighNews}개)`);
        } catch (error) {
          console.error("GitHub Actions 트리거 실패:", error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "감성 분석 완료",
        stocks: stocks.length,
        important_news_count: totalMediumOrHighNews,
        triggered_analysis: totalMediumOrHighNews >= 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
