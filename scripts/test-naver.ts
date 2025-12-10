// Naver News API 연결 테스트 스크립트

import { loadEnv } from "./utils/env.ts";
import { logError } from "./utils/error-handler.ts";

async function testNaverAPI() {
  console.log("🔍 Naver News API 연결 테스트 시작...\n");

  try {
    const { naverClientId, naverClientSecret } = loadEnv();

    // 테스트 쿼리: "삼성전자" 뉴스 검색
    const query = encodeURIComponent("삼성전자");
    const url = `https://openapi.naver.com/v1/search/news.json?query=${query}&display=5&sort=date`;

    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": naverClientId,
        "X-Naver-Client-Secret": naverClientSecret,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 호출 실패: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();

    console.log("✅ Naver News API 연결 성공!");
    console.log(`📊 검색 결과: ${data.total}개`);
    console.log(`📰 반환된 뉴스: ${data.items.length}개`);
    console.log("\n샘플 뉴스:");
    data.items.slice(0, 3).forEach((item: { title: string; link: string }, index: number) => {
      console.log(`  ${index + 1}. ${item.title}`);
      console.log(`     ${item.link}`);
    });

    return true;
  } catch (error) {
    logError("❌ Naver News API 연결 실패:", error);
    return false;
  }
}

if (import.meta.main) {
  const success = await testNaverAPI();
  Deno.exit(success ? 0 : 1);
}

