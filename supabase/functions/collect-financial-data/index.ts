// Supabase Edge Function: 재무 데이터 수집
// 1시간마다 실행되어 종목별 재무 데이터를 수집하고 financial_data 테이블에 저장

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

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
 * DART는 종목코드가 아닌 고유 법인코드(corp_code)가 필요하므로 스킵
 * 대신 네이버 금융에서 모든 데이터 수집
 */
async function fetchDARTFinancialData(
  stockCode: string,
  apiKey: string
): Promise<any | null> {
  // DART API는 법인코드 매핑 테이블이 필요하므로 현재는 스킵
  // 향후 개선: corp_code 매핑 테이블 구축
  console.log(`DART API 스킵 (법인코드 매핑 필요): ${stockCode}`);
  return null;
}

/**
 * 네이버 금융에서 PER/PBR 등 시장 지표 수집
 * deno_dom을 사용한 HTML 파싱으로 정확도 향상
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
      console.log(`네이버 금융 접근 실패 (${stockCode}): HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    if (!doc) {
      console.log(`HTML 파싱 실패 (${stockCode})`);
      return null;
    }

    const marketData: any = {};

    // 1. 주요 투자지표 테이블에서 PER, PBR, ROE 추출
    const tables = doc.querySelectorAll("table");

    for (const table of tables) {
      const rows = (table as any).querySelectorAll("tr");

      for (const row of rows) {
        const cells = (row as any).querySelectorAll("th, td");
        const cellTexts = Array.from(cells).map((cell: any) =>
          cell.textContent?.replace(/\s+/g, " ").trim() || ""
        );

        // PER (주가수익비율)
        if (cellTexts.some((text) => text.includes("PER"))) {
          const perIndex = cellTexts.findIndex((text) => text.includes("PER"));
          if (perIndex >= 0 && perIndex + 1 < cellTexts.length) {
            const perText = cellTexts[perIndex + 1];
            const perMatch = perText.match(/(\d+\.?\d*)/);
            if (perMatch) {
              marketData.per = parseFloat(perMatch[1]);
            }
          }
        }

        // PBR (주가순자산비율)
        if (cellTexts.some((text) => text.includes("PBR"))) {
          const pbrIndex = cellTexts.findIndex((text) => text.includes("PBR"));
          if (pbrIndex >= 0 && pbrIndex + 1 < cellTexts.length) {
            const pbrText = cellTexts[pbrIndex + 1];
            const pbrMatch = pbrText.match(/(\d+\.?\d*)/);
            if (pbrMatch) {
              marketData.pbr = parseFloat(pbrMatch[1]);
            }
          }
        }

        // ROE (자기자본이익률)
        if (cellTexts.some((text) => text.includes("ROE"))) {
          const roeIndex = cellTexts.findIndex((text) => text.includes("ROE"));
          if (roeIndex >= 0 && roeIndex + 1 < cellTexts.length) {
            const roeText = cellTexts[roeIndex + 1];
            const roeMatch = roeText.match(/(\d+\.?\d*)/);
            if (roeMatch) {
              marketData.roe = parseFloat(roeMatch[1]);
            }
          }
        }

        // 부채비율
        if (cellTexts.some((text) => text.includes("부채비율"))) {
          const debtIndex = cellTexts.findIndex((text) => text.includes("부채비율"));
          if (debtIndex >= 0 && debtIndex + 1 < cellTexts.length) {
            const debtText = cellTexts[debtIndex + 1];
            const debtMatch = debtText.match(/(\d+\.?\d*)/);
            if (debtMatch) {
              marketData.debtRatio = parseFloat(debtMatch[1]);
            }
          }
        }

        // 당좌비율
        if (cellTexts.some((text) => text.includes("당좌비율"))) {
          const currentIndex = cellTexts.findIndex((text) => text.includes("당좌비율"));
          if (currentIndex >= 0 && currentIndex + 1 < cellTexts.length) {
            const currentText = cellTexts[currentIndex + 1];
            const currentMatch = currentText.match(/(\d+\.?\d*)/);
            if (currentMatch) {
              marketData.currentRatio = parseFloat(currentMatch[1]);
            }
          }
        }

        // 매출액
        if (cellTexts.some((text) => text.includes("매출액"))) {
          const revenueIndex = cellTexts.findIndex((text) => text.includes("매출액"));
          if (revenueIndex >= 0 && revenueIndex + 1 < cellTexts.length) {
            const revenueText = cellTexts[revenueIndex + 1];
            const revenueMatch = revenueText.match(/(\d+)/);
            if (revenueMatch) {
              marketData.revenue = parseInt(revenueMatch[1]);
            }
          }
        }

        // 영업이익
        if (cellTexts.some((text) => text.includes("영업이익"))) {
          const opIndex = cellTexts.findIndex((text) => text.includes("영업이익"));
          if (opIndex >= 0 && opIndex + 1 < cellTexts.length) {
            const opText = cellTexts[opIndex + 1];
            const opMatch = opText.match(/(\d+)/);
            if (opMatch) {
              marketData.operatingProfit = parseInt(opMatch[1]);
            }
          }
        }

        // 당기순이익
        if (cellTexts.some((text) => text.includes("당기순이익"))) {
          const netIndex = cellTexts.findIndex((text) => text.includes("당기순이익"));
          if (netIndex >= 0 && netIndex + 1 < cellTexts.length) {
            const netText = cellTexts[netIndex + 1];
            const netMatch = netText.match(/(\d+)/);
            if (netMatch) {
              marketData.netProfit = parseInt(netMatch[1]);
            }
          }
        }
      }
    }

    if (Object.keys(marketData).length > 0) {
      console.log(`✓ 네이버 금융 데이터 수집 성공 (${stockCode}):`, Object.keys(marketData).join(", "));
      return marketData;
    } else {
      console.log(`⚠️  네이버 금융 데이터 없음 (${stockCode})`);
      return null;
    }
  } catch (error) {
    console.error(`네이버 금융 데이터 수집 실패 (${stockCode}):`, error);
    return null;
  }
}
