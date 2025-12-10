// Supabase Edge Function: 뉴스 수집
// Naver News API를 사용하여 종목별 뉴스를 수집하고 Supabase에 저장

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// scripts의 함수들을 import
import { collectNewsForStock } from "../../../scripts/collect-news.ts";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  try {
    // Supabase 클라이언트 생성 (Edge Functions에서는 자동으로 제공됨)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY")!;
    const naverClientId = Deno.env.get("NAVER_CLIENT_ID")!;
    const naverClientSecret = Deno.env.get("NAVER_CLIENT_SECRET")!;

    if (!supabaseUrl || !supabaseServiceKey || !naverClientId || !naverClientSecret) {
      throw new Error("필수 환경 변수가 설정되지 않았습니다.");
    }

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
        JSON.stringify({ message: "활성화된 종목이 없습니다.", saved: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let totalSaved = 0;

    for (const stock of stocks) {
      const saved = await collectNewsForStock(supabase, stock.code, stock.id, stock.name);
      totalSaved += saved;
    }

    return new Response(
      JSON.stringify({ message: "뉴스 수집 완료", saved: totalSaved, stocks: stocks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

