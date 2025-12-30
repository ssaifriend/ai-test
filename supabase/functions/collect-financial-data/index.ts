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

    // 활성화된 종목 조회 (corp_code 포함)
    const { data: stocks, error: stocksError } = await supabase
      .from("stocks")
      .select("id, code, name, corp_code")
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

        // 1. 법인코드가 없으면 DART에서 조회하여 저장
        let corpCode = stock.corp_code;
        if (dartApiKey && !corpCode) {
          corpCode = await fetchCorpCode(stock.code, dartApiKey);
          if (corpCode) {
            // 법인코드를 stocks 테이블에 저장
            await supabase
              .from("stocks")
              .update({ corp_code: corpCode })
              .eq("id", stock.id);
            console.log(`✓ 법인코드 저장 완료 (${stock.name}): ${corpCode}`);
          }
        }

        // 2. DART API로 재무제표 데이터 수집
        if (dartApiKey && corpCode) {
          const dartData = await fetchDARTFinancialData(corpCode, dartApiKey);
          if (dartData) {
            financialData = { ...financialData, ...dartData };
            dataSource = "dart";
          }
        }

        // 3. 네이버 금융에서 PER/PBR 등 시장 지표 수집
        const naverData = await fetchNaverFinanceData(stock.code);
        if (naverData) {
          financialData = { ...financialData, ...naverData };
          if (dataSource === "unknown") {
            dataSource = "naver";
          } else {
            dataSource = "dart,naver";
          }
        }

        // 4. 데이터베이스에 저장 (upsert)
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
 * DART에서 종목코드로 법인코드 조회
 * DART 공시업체 목록 조회 API 사용
 */
async function fetchCorpCode(
  stockCode: string,
  apiKey: string
): Promise<string | null> {
  try {
    // DART 고유번호 조회 API (corpCode.xml)
    const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.log(`DART 법인코드 조회 실패 (${stockCode}): HTTP ${response.status}`);
      return null;
    }

    const xml = await response.text();

    // XML에서 stock_code와 매칭되는 corp_code 찾기
    // 형식: <list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code>...
    const regex = new RegExp(
      `<corp_code>([^<]+)</corp_code>[^<]*<corp_name>[^<]*</corp_name>[^<]*<stock_code>${stockCode}</stock_code>`,
      "i"
    );
    const match = xml.match(regex);

    if (match && match[1]) {
      console.log(`✓ 법인코드 조회 성공 (${stockCode}): ${match[1]}`);
      return match[1];
    }

    console.log(`⚠️  법인코드 없음 (${stockCode})`);
    return null;
  } catch (error) {
    console.error(`DART 법인코드 조회 실패 (${stockCode}):`, error);
    return null;
  }
}

/**
 * DART API를 통한 재무제표 데이터 수집
 * 최신 사업보고서 또는 분기보고서에서 재무 데이터 추출
 */
async function fetchDARTFinancialData(
  corpCode: string,
  apiKey: string
): Promise<any | null> {
  try {
    // 현재 연도와 분기 계산
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 최근 4개 분기 시도 (가장 최근 보고서 찾기)
    const quarters = [];
    for (let i = 0; i < 4; i++) {
      const targetDate = new Date(year, month - 1 - i * 3, 1);
      const y = targetDate.getFullYear();
      const m = targetDate.getMonth() + 1;
      const q = Math.ceil(m / 3);
      quarters.push({ year: y, quarter: q });
    }

    // 단일회사 주요계정 조회 API
    for (const { year: bsnsYear, quarter } of quarters) {
      try {
        const reprtCode = quarter === 4 ? "11011" : `1101${quarter}`; // 11011=사업보고서, 11012=반기, 11013=1분기, 11014=3분기

        const url = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${bsnsYear}&reprt_code=${reprtCode}&fs_div=CFS`;

        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();

        if (data.status === "000" && data.list && data.list.length > 0) {
          // 주요 계정과목 추출
          const financialData: any = {};

          for (const item of data.list) {
            const accountName = item.account_nm;
            const value = parseInt(item.thstrm_amount || "0");

            // 매출액
            if (accountName.includes("매출액") && !accountName.includes("영업")) {
              financialData.revenue = value;
            }
            // 영업이익
            if (accountName.includes("영업이익")) {
              financialData.operatingProfit = value;
            }
            // 당기순이익
            if (accountName.includes("당기순이익") && accountName.includes("지배")) {
              financialData.netProfit = value;
            }
            // 부채총계
            if (accountName === "부채총계") {
              financialData.totalLiabilities = value;
            }
            // 자본총계
            if (accountName === "자본총계") {
              financialData.totalEquity = value;
            }
            // 유동자산
            if (accountName === "유동자산") {
              financialData.currentAssets = value;
            }
            // 유동부채
            if (accountName === "유동부채") {
              financialData.currentLiabilities = value;
            }
          }

          // 비율 계산
          if (financialData.totalLiabilities && financialData.totalEquity) {
            financialData.debtRatio = (financialData.totalLiabilities / financialData.totalEquity) * 100;
          }
          if (financialData.currentAssets && financialData.currentLiabilities) {
            financialData.currentRatio = (financialData.currentAssets / financialData.currentLiabilities) * 100;
          }
          if (financialData.netProfit && financialData.totalEquity) {
            financialData.roe = (financialData.netProfit / financialData.totalEquity) * 100;
          }

          if (Object.keys(financialData).length > 0) {
            console.log(`✓ DART 재무 데이터 수집 성공 (${corpCode}, ${bsnsYear}Q${quarter}):`, Object.keys(financialData).join(", "));
            return financialData;
          }
        }
      } catch (quarterError) {
        // 해당 분기 실패 시 다음 분기 시도
        continue;
      }
    }

    console.log(`⚠️  DART 재무 데이터 없음 (${corpCode})`);
    return null;
  } catch (error) {
    console.error(`DART 재무 데이터 수집 실패 (${corpCode}):`, error);
    return null;
  }
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
