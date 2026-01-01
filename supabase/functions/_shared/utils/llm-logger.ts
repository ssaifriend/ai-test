/**
 * LLM 사용량 로깅 유틸리티
 * llm_usage_logs 테이블에 비용 및 토큰 사용량을 기록합니다.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadEnv } from "./env.ts";

export type LLMOperation = "sentiment" | "structure" | "agent" | "synthesis" | "debate";

export interface LLMUsageLog {
  operation: LLMOperation;
  model: string;
  stock_id?: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms?: number;
  success?: boolean;
  error_message?: string;
}

/**
 * LLM 사용량을 llm_usage_logs 테이블에 기록합니다.
 */
export async function logLLMUsage(log: LLMUsageLog): Promise<void> {
  try {
    // Supabase 클라이언트 생성
    let supabaseUrl = Deno.env.get("SUPABASE_URL");
    let supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // 로컬 실행 시에는 loadEnv()로 읽기
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      const env = loadEnv();
      supabaseUrl = env.supabaseUrl;
      supabaseServiceRoleKey = env.supabaseServiceKey;
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

    // 로그 삽입
    const { error } = await supabase
      .from("llm_usage_logs")
      .insert({
        operation: log.operation,
        model: log.model,
        stock_id: log.stock_id || null,
        input_tokens: log.input_tokens,
        output_tokens: log.output_tokens,
        cost_usd: log.cost_usd,
        latency_ms: log.latency_ms || null,
        success: log.success !== false, // 기본값 true
        error_message: log.error_message || null,
      });

    if (error) {
      console.error("LLM 사용량 로깅 실패:", error);
    }
  } catch (error) {
    // 로깅 실패해도 메인 로직에 영향 없도록
    console.error("LLM 사용량 로깅 중 예외:", error);
  }
}

/**
 * OpenAI API 비용 계산
 * 모델별 가격은 2024년 기준 (입력/출력 토큰당 가격, USD)
 */
export function calculateOpenAICost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 0.0000025, output: 0.00001 },
    "gpt-4o-mini": { input: 0.00000015, output: 0.0000006 },
    "gpt-4-turbo": { input: 0.00001, output: 0.00003 },
    "gpt-4": { input: 0.00003, output: 0.00006 },
    "gpt-3.5-turbo": { input: 0.0000005, output: 0.0000015 },
  };

  const modelPricing = pricing[model] || pricing["gpt-4o-mini"]; // 기본값
  return inputTokens * modelPricing.input + outputTokens * modelPricing.output;
}
