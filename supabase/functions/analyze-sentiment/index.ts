// Supabase Edge Function: 감성 분석
// 분석되지 않은 뉴스에 대해 배치 감성 분석을 수행하고 결과를 저장

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzeSentimentForStock } from "../../scripts/analyze-sentiment.ts";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      throw new Error("필수 환경 변수가 설정되지 않았습니다.");
    }

    Deno.env.set("SUPABASE_URL", supabaseUrl);
    Deno.env.set("SUPABASE_SERVICE_KEY", supabaseServiceKey);
    Deno.env.set("OPENAI_API_KEY", openaiApiKey);

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
      return new Response(
        JSON.stringify({ message: "활성화된 종목이 없습니다." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    for (const stock of stocks) {
      await analyzeSentimentForStock(supabase, stock.id);
    }

    return new Response(
      JSON.stringify({ message: "감성 분석 완료", stocks: stocks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

