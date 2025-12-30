// Supabase 연결 테스트 스크립트

import { loadEnv } from "./utils/env.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError } from "./utils/error-handler.ts";

async function testSupabase() {
  console.log("🔍 Supabase 연결 테스트 시작...\n");

  try {
    const { supabaseUrl, supabaseServiceKey } = loadEnv();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // stocks 테이블 조회 테스트
    console.log("📊 stocks 테이블 조회 중...");
    const { data: stocks, error: stocksError } = await supabase
      .from("stocks")
      .select("id, code, name")
      .limit(5);

    if (stocksError) {
      throw stocksError;
    }

    console.log("✅ Supabase 연결 성공!");
    console.log(`📊 stocks 테이블 레코드 수: ${stocks?.length || 0}개`);

    if (stocks && stocks.length > 0) {
      console.log("\n종목 목록:");
      stocks.forEach((stock) => {
        console.log(`  - ${stock.code}: ${stock.name}`);
      });
    } else {
      console.log("\n⚠️  stocks 테이블이 비어있습니다.");
    }

    // news_sources 테이블 조회 테스트
    console.log("\n📰 news_sources 테이블 조회 중...");
    const { data: sources, error: sourcesError } = await supabase
      .from("news_sources")
      .select("name, tier")
      .limit(5);

    if (sourcesError) {
      console.warn(`⚠️  news_sources 테이블 조회 실패: ${sourcesError.message}`);
    } else {
      console.log(`✅ news_sources 테이블 레코드 수: ${sources?.length || 0}개`);
      if (sources && sources.length > 0) {
        console.log("\n언론사 목록:");
        sources.forEach((source) => {
          console.log(`  - ${source.name} (Tier ${source.tier})`);
        });
      }
    }

    return true;
  } catch (error) {
    logError("❌ Supabase 연결 실패:", error);
    return false;
  }
}

if (import.meta.main) {
  const success = await testSupabase();
  Deno.exit(success ? 0 : 1);
}

