// Supabase Edge Function: 뉴스 필터링
// 수집된 뉴스에 필터링을 적용 (필터 완전 비활성화 상태)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

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

    if (!supabaseUrl || !supabaseServiceRoleKey) {
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

    let totalFiltered = 0;

    // 각 종목별로 필터링
    for (const stock of stocks) {
      // 미필터링 뉴스 조회
      const { data: rawNews, error: fetchError } = await supabase
        .from("news_articles")
        .select("*")
        .eq("stock_id", stock.id)
        .is("filter_score", null)
        .order("collected_at", { ascending: false })
        .limit(1000);

      if (fetchError || !rawNews || rawNews.length === 0) {
        continue;
      }

      // 필터링: 현재는 모든 뉴스를 통과시킴 (필터 비활성화 상태)
      // 매우 짧은 제목만 필터링 (5자 미만)
      for (const news of rawNews) {
        let filterScore = 0.5; // 기본 점수

        // 극도로 짧은 제목은 필터링
        if (news.title && news.title.length < 5) {
          continue;
        }

        // 설명 길이에 따른 점수
        if (news.description && news.description.length > 100) {
          filterScore += 0.1;
        }

        // 제목 길이 적절성
        if (news.title && news.title.length >= 20 && news.title.length <= 100) {
          filterScore += 0.1;
        }

        filterScore = Math.min(1.0, Math.max(0.0, filterScore));

        // filter_score 업데이트
        await supabase
          .from("news_articles")
          .update({ filter_score: filterScore })
          .eq("id", news.id);

        totalFiltered++;
      }
    }

    return new Response(
      JSON.stringify({ message: "필터링 완료", filtered: totalFiltered, stocks: stocks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("필터링 오류:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
