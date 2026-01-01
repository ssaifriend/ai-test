// Supabase Edge Function: Multi-Agent 분석
// 모든 Agent를 실행하고 결과를 통합하여 최종 투자 의견을 생성

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { SmartDataCollector } from "../_shared/services/smart-data-collector.ts";
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

        // 1. 스마트 데이터 수집
        const dataCollector = new SmartDataCollector(supabase);
        const financialData = await dataCollector.collectFinancialData(stock.code);
        const technicalData = await dataCollector.collectTechnicalData(stock.code);
        const newsData = await dataCollector.collectNewsData(stock.id);
        const macroData = await dataCollector.collectMacroData();
        const riskData = await dataCollector.collectRiskData(stock.code);

        // 2. 5개 Agent 병렬 실행
        const [fundamental, technical, news, macro, risk] = await Promise.all([
          runFundamentalAgent(stock.code, stock.name, financialData),
          runTechnicalAgent(stock.code, stock.name, technicalData),
          runNewsAgent(stock.code, stock.name, newsData),
          runMacroAgent(stock.code, stock.name, macroData),
          runRiskAgent(stock.code, stock.name, riskData),
        ]);

        const agentOpinions: AgentOpinions = {
          fundamental,
          technical,
          news,
          macro,
          risk,
        };

        // 3. Debate Agent 실행
        const debateResult = await runDebateAgent(agentOpinions, stock.name);

        // 4. Consensus 계산
        const consensus = calculateConsensus(agentOpinions);

        // 5. Synthesis Agent 실행
        const finalOpinion = await runSynthesisAgent(
          agentOpinions,
          debateResult,
          consensus,
          stock.name,
          technicalData.price
        );

        // 6. 결과 저장
        const { error: insertError } = await supabase.from("investment_opinions").insert({
          stock_id: stock.id,
          agent_version: "1.0",
          fundamental_opinion: fundamental.direction,
          fundamental_confidence: fundamental.confidence,
          fundamental_reasoning: fundamental.reasoning,
          fundamental_price: fundamental.targetPrice,
          technical_opinion: technical.direction,
          technical_confidence: technical.confidence,
          technical_reasoning: technical.reasoning,
          technical_price: technical.targetPrice,
          news_opinion: news.direction,
          news_confidence: news.confidence,
          news_reasoning: news.reasoning,
          news_price: news.targetPrice,
          macro_opinion: macro.direction,
          macro_confidence: macro.confidence,
          macro_reasoning: macro.reasoning,
          macro_price: macro.targetPrice,
          risk_opinion: risk.direction,
          risk_confidence: risk.confidence,
          risk_reasoning: risk.reasoning,
          risk_price: risk.targetPrice,
          debate_summary: debateResult.summary,
          debate_key_points: debateResult.keyPoints,
          consensus_direction: consensus.direction,
          consensus_confidence: consensus.confidence,
          synthesis_direction: finalOpinion.direction,
          synthesis_confidence: finalOpinion.confidence,
          synthesis_reasoning: finalOpinion.reasoning,
          synthesis_target_price: finalOpinion.targetPrice,
          synthesis_risk_factors: finalOpinion.riskFactors,
          synthesis_investment_strategy: finalOpinion.investmentStrategy,
          current_price: technicalData.price,
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
