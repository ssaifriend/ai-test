/**
 * 재무 데이터 수집 스크립트
 *
 * 1시간에 한 번씩 실행되어 종목별 재무 데이터를 수집하고
 * financial_data 테이블에 저장합니다.
 */

import { loadEnv } from "./utils/env.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError } from "./utils/error-handler.ts";

interface FinancialData {
  per?: number;
  pbr?: number;
  roe?: number;
  debtRatio?: number;
  currentRatio?: number;
  revenue?: number;
  operatingProfit?: number;
  netProfit?: number;
}

/**
 * DART API를 통한 재무제표 데이터 수집
 */
async function fetchDARTFinancialData(
  stockCode: string,
  apiKey: string
): Promise<Partial<FinancialData> | null> {
  try {
    const currentYear = new Date().getFullYear();
    const reportCode = "11013"; // 1분기보고서

    // DART API는 종목코드가 아닌 corp_code 필요
    // 간단히 종목코드로 시도 (실제로는 corp_code 변환 로직 필요)
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

    // 재무제표 조회
    const financialUrl = `https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${currentYear}&reprt_code=${reportCode}`;
    const response = await fetch(financialUrl);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.status !== "000" || !data.list || data.list.length === 0) {
      return null;
    }

    // 재무제표 데이터 파싱
    const financials: Partial<FinancialData> = {};

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
    logError(`DART API 호출 실패 (${stockCode}):`, error);
    return null;
  }
}

/**
 * 네이버 금융에서 PER/PBR 등 시장 지표 수집
 */
async function fetchNaverFinanceData(
  stockCode: string
): Promise<Partial<FinancialData> | null> {
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

    // HTML에서 PER, PBR 추출
    const perMatch = html.match(/PER[^<]*?(\d+\.?\d*)/i);
    const pbrMatch = html.match(/PBR[^<]*?(\d+\.?\d*)/i);
    const roeMatch = html.match(/ROE[^<]*?(\d+\.?\d*)/i);
    const debtRatioMatch = html.match(/부채비율[^<]*?(\d+\.?\d*)/i);

    const marketData: Partial<FinancialData> = {};

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
    logError(`네이버 금융 데이터 수집 실패 (${stockCode}):`, error);
    return null;
  }
}

/**
 * 종목별 재무 데이터 수집 및 저장
 */
async function collectFinancialDataForStock(
  supabase: ReturnType<typeof createClient<any, "public">>,
  stock: { id: string; code: string; name: string },
  dartApiKey?: string
): Promise<void> {
  console.log(`📊 ${stock.name} (${stock.code}) 재무 데이터 수집 중...`);

  let financialData: Partial<FinancialData> = {};
  let dataSource = "unknown";

  try {
    // 1. DART API로 재무제표 데이터 수집
    if (dartApiKey) {
      const dartData = await fetchDARTFinancialData(stock.code, dartApiKey);
      if (dartData) {
        financialData = { ...financialData, ...dartData };
        dataSource = "dart";
        console.log(`  ✅ DART 데이터 수집 완료`);
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
      console.log(`  ✅ 네이버 금융 데이터 수집 완료`);
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

      console.log(`  💾 데이터베이스 저장 완료 (출처: ${dataSource})`);
    } else {
      console.log(`  ⚠️  수집된 데이터가 없습니다.`);
    }
  } catch (error) {
    logError(`  ❌ 재무 데이터 수집 실패:`, error);
  }
}

async function main() {
  console.log("📊 재무 데이터 수집 시작...\n");

  try {
    const { supabaseUrl, supabaseServiceKey, dartApiKey } = loadEnv();
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
      console.log("⚠️  활성화된 종목이 없습니다.");
      return;
    }

    console.log(`📋 총 ${stocks.length}개 종목 처리 예정\n`);

    for (const stock of stocks) {
      await collectFinancialDataForStock(supabase, stock, dartApiKey);

      // API 호출 간 딜레이 (Rate Limit 방지)
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log("\n✨ 재무 데이터 수집 완료!");
  } catch (error) {
    logError("❌ 재무 데이터 수집 실패:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
