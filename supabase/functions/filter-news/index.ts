// Supabase Edge Function: 뉴스 필터링
// 수집된 뉴스에 필터링을 적용하고 통계를 수집

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runFilteringPipeline } from "../../scripts/filter-news.ts";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("필수 환경 변수가 설정되지 않았습니다.");
    }

    Deno.env.set("SUPABASE_URL", supabaseUrl);
    Deno.env.set("SUPABASE_SERVICE_KEY", supabaseServiceKey);

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

    // 현재 시간대 판단
    const now = new Date();
    const hour = now.getHours();
    let timePeriod: "peak" | "active" | "off" = "off";

    if (hour >= 9 && hour < 15) {
      timePeriod = "peak";
    } else if ((hour >= 8 && hour < 9) || (hour >= 15 && hour < 20)) {
      timePeriod = "active";
    }

    for (const stock of stocks) {
      await runFilteringPipeline(supabase, stock.id, timePeriod);
    }

    return new Response(
      JSON.stringify({ message: "필터링 완료", stocks: stocks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

