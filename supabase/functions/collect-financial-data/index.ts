// Supabase Edge Function: 재무 데이터 수집
// 1시간마다 실행되어 종목별 재무 데이터를 수집하고 financial_data 테이블에 저장

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
    const dartApiKey = Deno.env.get("DART_API_KEY");

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

    let successCount = 0;
    let failCount = 0;

    for (const stock of stocks) {
      try {
        let financialData: any = {};
        let dataSource = "unknown";

        // 1. DART API로 재무제표 데이터 수집
        if (dartApiKey) {
          const dartData = await fetchDARTFinancialData(stock.code, dartApiKey);
          if (dartData) {
            financialData = { ...financialData, ...dartData };
            dataSource = "dart";
          }
        }

        // 2. 네이버 금융에서 PER/PBR 등 시장 지표 수집
        const naverData = await fetchNaverFinanceData(stock.code);
        if (naverData) {
          financialData = { ...financialData, ...naverData };
          if (dataSource === "unknown") {
            dataSource = "naver";
          } else {
            dataSource = "dart,naver";
          }
        }

        // 3. 데이터베이스에 저장 (upsert)
        if (Object.keys(financialData).length > 0) {
          const { error: upsertError } = await supabase
            .from("financial_data")
            .upsert({
              stock_id: stock.id,
              stock_code: stock.code,
              per: financialData.per,
              pbr: financialData.pbr,
              roe: financialData.roe,
              debt_ratio: financialData.debtRatio,
              current_ratio: financialData.currentRatio,
              revenue: financialData.revenue,
              operating_profit: financialData.operatingProfit,
              net_profit: financialData.netProfit,
              data_source: dataSource,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: "stock_id",
            });

          if (upsertError) {
            throw upsertError;
          }

          successCount++;
        } else {
          failCount++;
        }

        // API 호출 간 딜레이 (Rate Limit 방지)
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`재무 데이터 수집 실패 (${stock.name}):`, error);
        failCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "재무 데이터 수집 완료",
        total: stocks.length,
        success: successCount,
        fail: failCount
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

/**
 * DART API를 통한 재무제표 데이터 수집
 */
async function fetchDARTFinancialData(
  stockCode: string,
  apiKey: string
): Promise<any | null> {
  try {
    const currentYear = new Date().getFullYear();
    const reportCode = "11013"; // 1분기보고서

    const companyInfoUrl = `https://opendart.fss.or.kr/api/company.json?crtfc_key=${apiKey}&corp_code=${stockCode}`;
    const companyResponse = await fetch(companyInfoUrl);

    if (!companyResponse.ok) {
      return null;
    }

    const companyData = await companyResponse.json();
    if (companyData.status !== "000") {
      return null;
    }

    const corpCode = companyData.corp_code || stockCode;

    const financialUrl = `https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${currentYear}&reprt_code=${reportCode}`;
    const response = await fetch(financialUrl);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.status !== "000" || !data.list || data.list.length === 0) {
      return null;
    }

    const financials: any = {};

    for (const item of data.list) {
      const accountNm = item.account_nm;
      const thstrmAmount = parseFloat(item.thstrm_amount?.replace(/,/g, "") || "0");

      if (accountNm.includes("당기순이익") || accountNm.includes("당기순손익")) {
        if (!financials.netProfit || Math.abs(thstrmAmount) > Math.abs(financials.netProfit || 0)) {
          financials.netProfit = thstrmAmount;
        }
      }
      if (accountNm.includes("영업이익")) {
        if (!financials.operatingProfit || Math.abs(thstrmAmount) > Math.abs(financials.operatingProfit || 0)) {
          financials.operatingProfit = thstrmAmount;
        }
      }
      if (accountNm.includes("매출액") || accountNm.includes("매출")) {
        if (!financials.revenue || Math.abs(thstrmAmount) > Math.abs(financials.revenue || 0)) {
          financials.revenue = thstrmAmount;
        }
      }
    }

    return Object.keys(financials).length > 0 ? financials : null;
  } catch (error) {
    console.error(`DART API 호출 실패 (${stockCode}):`, error);
    return null;
  }
}

/**
 * 네이버 금융에서 PER/PBR 등 시장 지표 수집
 */
async function fetchNaverFinanceData(stockCode: string): Promise<any | null> {
  try {
    const url = `https://finance.naver.com/item/main.naver?code=${stockCode}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    const perMatch = html.match(/PER[^<]*?(\d+\.?\d*)/i);
    const pbrMatch = html.match(/PBR[^<]*?(\d+\.?\d*)/i);
    const roeMatch = html.match(/ROE[^<]*?(\d+\.?\d*)/i);
    const debtRatioMatch = html.match(/부채비율[^<]*?(\d+\.?\d*)/i);

    const marketData: any = {};

    if (perMatch && perMatch[1]) {
      marketData.per = parseFloat(perMatch[1]);
    }
    if (pbrMatch && pbrMatch[1]) {
      marketData.pbr = parseFloat(pbrMatch[1]);
    }
    if (roeMatch && roeMatch[1]) {
      marketData.roe = parseFloat(roeMatch[1]);
    }
    if (debtRatioMatch && debtRatioMatch[1]) {
      marketData.debtRatio = parseFloat(debtRatioMatch[1]);
    }

    return Object.keys(marketData).length > 0 ? marketData : null;
  } catch (error) {
    console.error(`네이버 금융 데이터 수집 실패 (${stockCode}):`, error);
    return null;
  }
}
