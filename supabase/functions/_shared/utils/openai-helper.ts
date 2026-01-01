/**
 * OpenAI API 헬퍼 함수
 * Edge Functions 환경에서 fetch API를 사용하여 OpenAI API를 호출합니다.
 */

import { loadEnv } from "./env.ts";
import { logLLMUsage, calculateOpenAICost, type LLMOperation } from "./llm-logger.ts";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  response_format?: { type: "json_object" | "text" };
  max_tokens?: number;
  // 로깅용 메타데이터 (선택적)
  operation?: LLMOperation;
  stock_id?: string;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Chat Completion API를 호출합니다.
 * Edge Functions 환경과 로컬 실행 모두 지원합니다.
 * 자동으로 LLM 사용량을 llm_usage_logs 테이블에 기록합니다.
 */
export async function createChatCompletion(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const startTime = Date.now();

  // Edge Functions 환경에서는 Deno.env.get()로 직접 읽기
  let openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  // 로컬 실행 시에는 loadEnv()로 읽기
  if (!openaiApiKey) {
    const env = loadEnv();
    openaiApiKey = env.openaiApiKey;
  }

  // 로깅용 메타데이터 추출 (API 요청에는 포함하지 않음)
  const { operation, stock_id, ...apiRequest } = request;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(apiRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `OpenAI API 오류: ${response.status} ${response.statusText}\n${errorText}`;

      // 실패 로그 기록
      if (operation) {
        await logLLMUsage({
          operation,
          model: request.model,
          stock_id,
          input_tokens: 0,
          output_tokens: 0,
          cost_usd: 0,
          latency_ms: Date.now() - startTime,
          success: false,
          error_message: errorMsg,
        });
      }

      throw new Error(errorMsg);
    }

    const result: ChatCompletionResponse = await response.json();
    const latencyMs = Date.now() - startTime;

    // 성공 로그 기록
    if (operation && result.usage) {
      const costUsd = calculateOpenAICost(
        request.model,
        result.usage.prompt_tokens,
        result.usage.completion_tokens
      );

      await logLLMUsage({
        operation,
        model: request.model,
        stock_id,
        input_tokens: result.usage.prompt_tokens,
        output_tokens: result.usage.completion_tokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        success: true,
      });
    }

    return result;
  } catch (error) {
    // 예외 발생 시 로그 기록
    if (operation) {
      await logLLMUsage({
        operation,
        model: request.model,
        stock_id,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        latency_ms: Date.now() - startTime,
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}
