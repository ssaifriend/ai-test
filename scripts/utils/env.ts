// 환경 변수 로드 유틸리티

export function loadEnv(): {
  supabaseUrl: string;
  supabaseServiceKey: string;
  openaiApiKey: string;
  naverClientId: string;
  naverClientSecret: string;
  dartApiKey?: string;
} {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  const naverClientId = Deno.env.get("NAVER_CLIENT_ID");
  const naverClientSecret = Deno.env.get("NAVER_CLIENT_SECRET");
  const dartApiKey = Deno.env.get("DART_API_KEY"); // 선택사항

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL 환경 변수가 설정되지 않았습니다.");
  }
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_KEY 환경 변수가 설정되지 않았습니다.");
  }
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");
  }
  if (!naverClientId) {
    throw new Error("NAVER_CLIENT_ID 환경 변수가 설정되지 않았습니다.");
  }
  if (!naverClientSecret) {
    throw new Error("NAVER_CLIENT_SECRET 환경 변수가 설정되지 않았습니다.");
  }

  return {
    supabaseUrl,
    supabaseServiceKey,
    openaiApiKey,
    naverClientId,
    naverClientSecret,
    dartApiKey,
  };
}

