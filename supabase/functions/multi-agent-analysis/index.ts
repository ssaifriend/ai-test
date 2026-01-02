// Supabase Edge Function: Multi-Agent 분석
// 모든 Agent를 실행하고 결과를 통합하여 최종 투자 의견을 생성

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { SmartDataCollector } from "../_shared/services/smart-data-collector.ts";
import { KISApiClient } from "../_shared/utils/kis-api.ts";
import { runFundamentalAgent } from "../_shared/agents/fundamental.agent.ts";
import { runTechnicalAgent } from "../_shared/agents/technical.agent.ts";
import { runNewsAgent } from "../_shared/agents/news.agent.ts";
import { runMacroAgent } from "../_shared/agents/macro.agent.ts";
import { runRiskAgent } from "../_shared/agents/risk.agent.ts";
import { runDebateAgent, calculateConsensus, type AgentOpinions } from "../_shared/agents/debate.agent.ts";
import { runSynthesisAgent } from "../_shared/agents/synthesis.agent.ts";
import { logError } from "../_shared/utils/error-handler.ts";

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
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    if (!supabaseUrl || !supabaseServiceRoleKey || !openaiApiKey) {
      throw new Error("필수 환경 변수가 설정되지 않았습니다.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // KIS API 클라이언트 생성 (한 번만 생성하여 모든 종목에서 재사용)
    const kisAppKey = Deno.env.get("KIS_APP_KEY");
    const kisAppSecret = Deno.env.get("KIS_APP_SECRET");
    const kisClient = kisAppKey && kisAppSecret
      ? new KISApiClient(kisAppKey, kisAppSecret)
      : null;

    if (kisClient) {
      console.log("✅ KIS API 클라이언트 초기화 (토큰 재사용 모드)");
    } else {
      console.log("⚠️  KIS API 키 미설정 (기술적 분석 제한됨)");
    }

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

    for (const stock of stocks) {
      try {
        console.log(`\n📊 ${stock.name} (${stock.code}) 분석 시작...`);

        // 1. 스마트 데이터 수집기 생성 (KIS API 클라이언트 재사용)
        const dataCollector = new SmartDataCollector(supabase, kisClient);

        // 2. 5개 Agent 병렬 실행 (각 Agent가 내부에서 데이터 수집)
        const [fundamental, technical, news, macro, risk] = await Promise.all([
          runFundamentalAgent(stock.code, stock.name, dataCollector, stock.id),
          runTechnicalAgent(stock.code, stock.name, dataCollector, stock.id),
          runNewsAgent(stock.id, stock.name, dataCollector),
          runMacroAgent(stock.name, dataCollector, stock.id),
          runRiskAgent(stock.code, stock.name, dataCollector, stock.id),
        ]);

        const agentOpinions: AgentOpinions = {
          fundamental,
          technical,
          news,
          macro,
          risk,
        };

        // 3. Debate Agent 실행
        const debateResult = await runDebateAgent(agentOpinions, stock.id);

        // 4. Consensus 계산
        const consensus = calculateConsensus(agentOpinions);

        // 5. Synthesis Agent 실행
        const finalOpinion = await runSynthesisAgent(
          stock.name,
          stock.code,
          agentOpinions,
          debateResult,
          stock.id,
          technical.analysis.price
        );

        // 6. 결과 저장
        const { error: insertError } = await supabase.from("investment_opinions").insert({
          stock_id: stock.id,

          // 각 Agent 의견
          fundamental_rec: fundamental.recommendation,
          fundamental_confidence: fundamental.confidence,
          fundamental_reasoning: fundamental.reasoning,

          technical_rec: technical.recommendation,
          technical_confidence: technical.confidence,
          technical_reasoning: technical.reasoning,

          news_rec: news.recommendation,
          news_confidence: news.confidence,
          news_reasoning: news.reasoning,

          macro_rec: macro.recommendation,
          macro_confidence: macro.confidence,
          macro_reasoning: macro.reasoning,

          risk_rec: risk.recommendation,
          risk_confidence: risk.confidence,
          risk_reasoning: risk.reasoning,

          // 토론 결과
          had_debate: debateResult.hadDebate,
          debate_summary: debateResult.debateSummary,
          consensus_level: consensus,
          changed_agents: debateResult.changedAgents || [],

          // 최종 의견
          final_rec: finalOpinion.finalRecommendation,
          final_confidence: finalOpinion.finalConfidence,
          target_price: finalOpinion.targetPrice,
          stop_loss: finalOpinion.stopLoss,
          time_horizon: finalOpinion.timeHorizon,
          strategy: finalOpinion.strategy,
          key_reasons: finalOpinion.keyReasons,
          risks: finalOpinion.risks,

          // 메타 정보
          analysis_type: "full",
          synthesis_model: finalOpinion.synthesisModel,
          used_cache: dataCollector.hasUsedCache(),
          current_price: technical.analysis.price > 0 ? technical.analysis.price : null,
        });

        if (insertError) {
          throw insertError;
        }

        console.log(`✅ ${stock.name} 분석 완료`);
        successCount++;
      } catch (error) {
        logError(`${stock.name} 분석 실패:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Multi-Agent 분석 완료",
        total: stocks.length,
        success: successCount,
        failed: stocks.length - successCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Multi-Agent 분석 오류:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
