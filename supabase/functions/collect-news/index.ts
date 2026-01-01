// Supabase Edge Function: 뉴스 수집
// Naver News API를 사용하여 종목별 뉴스를 수집하고 Supabase에 저장

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

interface NewsItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
}

interface NaverNewsResponse {
  items: NewsItem[];
}

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
    // 환경 변수 가져오기
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const naverClientId = Deno.env.get("NAVER_CLIENT_ID")!;
    const naverClientSecret = Deno.env.get("NAVER_CLIENT_SECRET")!;

    if (!supabaseUrl || !supabaseServiceRoleKey || !naverClientId || !naverClientSecret) {
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
        JSON.stringify({ message: "활성화된 종목이 없습니다.", saved: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let totalSaved = 0;

    // 각 종목별로 뉴스 수집
    for (const stock of stocks) {
      const query = encodeURIComponent(stock.name);
      const url = `https://openapi.naver.com/v1/search/news.json?query=${query}&display=50&sort=date`;

      try {
        const response = await fetch(url, {
          headers: {
            "X-Naver-Client-Id": naverClientId,
            "X-Naver-Client-Secret": naverClientSecret,
          },
        });

        if (!response.ok) {
          console.error(`Naver API 호출 실패 (${stock.name}): ${response.status}`);
          continue;
        }

        const data: NaverNewsResponse = await response.json();

        for (const item of data.items) {
          // 중복 체크
          const { data: existing } = await supabase
            .from("news_articles")
            .select("id")
            .eq("stock_id", stock.id)
            .eq("url", item.link)
            .single();

          if (existing) {
            continue; // 이미 존재하는 뉴스는 스킵
          }

          // 뉴스 저장
          const newsArticle = {
            stock_id: stock.id,
            title: item.title.replace(/<[^>]*>/g, ""), // HTML 태그 제거
            description: item.description?.replace(/<[^>]*>/g, ""),
            url: item.link,
            published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
            collected_at: new Date().toISOString(),
            has_full_content: false,
            analyzed: false,
          };

          const { error } = await supabase.from("news_articles").insert(newsArticle);

          if (error) {
            console.error(`뉴스 저장 실패 (${item.title}):`, error);
            continue;
          }

          totalSaved++;
        }
      } catch (error) {
        console.error(`뉴스 수집 실패 (${stock.name}):`, error);
      }
    }

    return new Response(
      JSON.stringify({ message: "뉴스 수집 완료", saved: totalSaved, stocks: stocks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("뉴스 수집 오류:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
