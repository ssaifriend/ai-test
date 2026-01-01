// Supabase Edge Function: 감성 분석
// 분석되지 않은 뉴스에 대해 배치 감성 분석을 수행하고 결과를 저장

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { batchAnalyzeSentiment, type NewsItemForAnalysis } from "../_shared/services/sentiment-analyzer.ts";
import { logError } from "../_shared/utils/error-handler.ts";

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

    let totalAnalyzed = 0;

    for (const stock of stocks) {
      // 1. 분석되지 않은 뉴스 조회
      const { data: unanalyzedNews, error: fetchError } = await supabase
        .from("news_articles")
        .select("*")
        .eq("stock_id", stock.id)
        .eq("analyzed", false)
        .not("filter_score", "is", null)
        .order("collected_at", { ascending: false })
        .limit(500);

      if (fetchError || !unanalyzedNews || unanalyzedNews.length === 0) {
        continue;
      }

      // 2. 배치 분석을 위한 형식으로 변환
      const newsItemsForAnalysis: NewsItemForAnalysis[] = unanalyzedNews.map((news, index) => ({
        index,
        title: news.title,
        description: news.description || undefined,
      }));

      // 3. 배치 감성 분석 실행
      const results = await batchAnalyzeSentiment(newsItemsForAnalysis, 50);

      // 4. 결과 저장
      for (let i = 0; i < unanalyzedNews.length; i++) {
        const news = unanalyzedNews[i];
        const result = results[i];

        if (!result) {
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

          if (!updateError) {
            totalAnalyzed++;
          }
        } catch (error) {
          logError(`저장 실패 (${news.title}):`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "감성 분석 완료",
        stocks: stocks.length,
        analyzed: totalAnalyzed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("감성 분석 오류:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
