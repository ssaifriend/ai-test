// Multi-Agent 분석 스크립트
// 모든 Agent를 실행하고 결과를 통합하여 최종 투자 의견을 생성

import { loadEnv } from "./utils/env.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError } from "./utils/error-handler.ts";
import { SmartDataCollector } from "./services/smart-data-collector.ts";
import { runFundamentalAgent } from "./agents/fundamental.agent.ts";
import { runTechnicalAgent } from "./agents/technical.agent.ts";
import { runNewsAgent } from "./agents/news.agent.ts";
import { runMacroAgent } from "./agents/macro.agent.ts";
import { runRiskAgent } from "./agents/risk.agent.ts";
import { runDebateAgent, calculateConsensus, type AgentOpinions } from "./agents/debate.agent.ts";
import { runSynthesisAgent } from "./agents/synthesis.agent.ts";

/**
 * 종목별 Multi-Agent 분석 실행
 */
export async function runMultiAgentAnalysis(
  supabase: ReturnType<typeof createClient<any, "public">>,
  stockId: string,
  stockCode: string,
  stockName: string
): Promise<void> {
  console.log(`\n📊 ${stockName} (${stockCode}) 분석 시작...\n`);

  const startTime = Date.now();
  const dataCollector = new SmartDataCollector(supabase);

  try {
    // 0. 현재가 조회
    let currentPrice: number | undefined;
    try {
      const technicalData = await dataCollector.collectTechnicalData(stockCode);
      currentPrice = technicalData.price || undefined;
      console.log(`💰 현재가: ${currentPrice?.toLocaleString()}원`);
    } catch (error) {
      console.log("⚠️  현재가 조회 실패, 분석 계속 진행");
    }

    // 1. 각 Agent 실행 (병렬)
    console.log("🤖 Agent 실행 중...");
    const [fundamental, technical, news, macro, risk] = await Promise.all([
      runFundamentalAgent(stockCode, stockName, dataCollector, stockId),
      runTechnicalAgent(stockCode, stockName, dataCollector, stockId),
      runNewsAgent(stockId, stockName, dataCollector),
      runMacroAgent(stockName, dataCollector, stockId),
      runRiskAgent(stockCode, stockName, dataCollector, stockId),
    ]);

    // 캐시 사용 여부 확인
    const usedCache = dataCollector.hasUsedCache();

    const opinions: AgentOpinions = {
      fundamental,
      technical,
      news,
      macro,
      risk,
    };

    console.log(`  ✅ Fundamental: ${fundamental.recommendation} (${fundamental.confidence}%)`);
    console.log(`  ✅ Technical: ${technical.recommendation} (${technical.confidence}%)`);
    console.log(`  ✅ News: ${news.recommendation} (${news.confidence}%)`);
    console.log(`  ✅ Macro: ${macro.recommendation} (${macro.confidence}%)`);
    console.log(`  ✅ Risk: ${risk.recommendation} (${risk.confidence}%)\n`);

    // 2. 합의도 계산
    const consensusLevel = calculateConsensus(opinions);
    console.log(`📈 합의도: ${consensusLevel}%\n`);

    // 3. Debate Agent 실행 (합의도 < 70%일 때만)
    let debateResult;
    if (consensusLevel < 70) {
      console.log("💬 토론 시작...");
      debateResult = await runDebateAgent(opinions, stockId);
      console.log(`  ✅ 토론 완료 (합의도: ${debateResult.consensusLevel}%)\n`);
    } else {
      debateResult = {
        hadDebate: false,
        consensusLevel,
      };
      console.log("✅ 합의도가 충분하여 토론 생략\n");
    }

    // 4. Synthesis Agent 실행
    console.log("🔮 최종 의견 종합 중...");
    const synthesis = await runSynthesisAgent(stockName, stockCode, opinions, debateResult, stockId);
    console.log(`  ✅ 최종 의견: ${synthesis.finalRecommendation} (${synthesis.finalConfidence}%)`);
    console.log(`  📊 모델: ${synthesis.synthesisModel}\n`);

    // 5. 결과 저장
    const generationTime = Date.now() - startTime;

    const { error: insertError } = await supabase.from("investment_opinions").insert({
      stock_id: stockId,
      timestamp: new Date().toISOString(),

      // 각 Agent 의견
      fundamental_rec: opinions.fundamental.recommendation,
      fundamental_confidence: opinions.fundamental.confidence,
      fundamental_reasoning: opinions.fundamental.reasoning,

      technical_rec: opinions.technical.recommendation,
      technical_confidence: opinions.technical.confidence,
      technical_reasoning: opinions.technical.reasoning,

      news_rec: opinions.news.recommendation,
      news_confidence: opinions.news.confidence,
      news_reasoning: opinions.news.reasoning,

      macro_rec: opinions.macro.recommendation,
      macro_confidence: opinions.macro.confidence,
      macro_reasoning: opinions.macro.reasoning,

      risk_rec: opinions.risk.recommendation,
      risk_confidence: opinions.risk.confidence,
      risk_reasoning: opinions.risk.reasoning,

      // 토론 결과
      had_debate: debateResult.hadDebate,
      debate_summary: debateResult.debateSummary,
      consensus_level: debateResult.consensusLevel,
      changed_agents: debateResult.changedAgents || [],

      // 최종 의견
      final_rec: synthesis.finalRecommendation,
      final_confidence: synthesis.finalConfidence,
      current_price: currentPrice,
      target_price: synthesis.targetPrice,
      stop_loss: synthesis.stopLoss,
      time_horizon: synthesis.timeHorizon,
      strategy: synthesis.strategy,
      key_reasons: synthesis.keyReasons,
      risks: synthesis.risks,

      // 메타 정보
      analysis_type: "full",
      synthesis_model: synthesis.synthesisModel,
      generation_time_ms: generationTime,
      used_cache: usedCache,
    });

    if (insertError) {
      throw insertError;
    }

    console.log(`✨ 분석 완료 (소요 시간: ${generationTime}ms)\n`);
  } catch (error) {
    logError(`❌ 분석 실패 (${stockName}):`, error);
    throw error;
  }
}

async function main() {
  console.log("🚀 Multi-Agent 분석 시작...\n");

  try {
    const { supabaseUrl, supabaseServiceKey } = loadEnv();
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

    console.log(`📊 분석 대상 종목: ${stocks.length}개\n`);

    for (const stock of stocks) {
      try {
        await runMultiAgentAnalysis(supabase, stock.id, stock.code, stock.name);
      } catch (error) {
        logError(`종목 분석 실패 (${stock.name}):`, error);
        // 다음 종목 계속 진행
      }
    }

    console.log("✨ 전체 분석 완료!");
  } catch (error) {
    logError("❌ Multi-Agent 분석 실패:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}

