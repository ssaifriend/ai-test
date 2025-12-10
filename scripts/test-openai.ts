// OpenAI API 연결 테스트 스크립트

import { loadEnv } from "./utils/env.ts";

async function testOpenAI() {
  console.log("🔍 OpenAI API 연결 테스트 시작...\n");

  try {
    const { openaiApiKey } = loadEnv();

    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const models = data.data as Array<{ id: string }>;

    console.log("✅ OpenAI API 연결 성공!");
    console.log(`📊 사용 가능한 모델 수: ${models.length}`);
    console.log("\n주요 모델 목록:");
    models
      .filter((m) => m.id.includes("gpt-4"))
      .slice(0, 5)
      .forEach((model) => {
        console.log(`  - ${model.id}`);
      });

    return true;
  } catch (error) {
    console.error("❌ OpenAI API 연결 실패:");
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  }
}

if (import.meta.main) {
  const success = await testOpenAI();
  Deno.exit(success ? 0 : 1);
}

