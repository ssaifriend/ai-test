/**
 * OpenAI API 헬퍼 함수
 * Edge Functions 환경에서 fetch API를 사용하여 OpenAI API를 호출합니다.
 */

import { loadEnv } from "./env.ts";

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
 */
export async function createChatCompletion(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  // Edge Functions 환경에서는 Deno.env.get()로 직접 읽기
  let openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  // 로컬 실행 시에는 loadEnv()로 읽기
  if (!openaiApiKey) {
    const env = loadEnv();
    openaiApiKey = env.openaiApiKey;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API 오류: ${response.status} ${response.statusText}\n${errorText}`
    );
  }

  return await response.json();
}
