/**
 * 뉴스 원문 크롤러 서비스
 * 
 * 중요도가 높은 뉴스의 원문을 수집하고 본문을 추출합니다.
 * Naver 뉴스의 경우 `#newsct_article` 셀렉터를 사용하여 본문을 추출합니다.
 */

import { load } from "cheerio";

export interface CrawledContent {
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

/**
 * 뉴스 URL에서 본문을 크롤링합니다.
 * 
 * @param url - 크롤링할 뉴스 URL
 * @param timeoutMs - 타임아웃 시간 (밀리초, 기본값: 10000)
 * @returns 크롤링된 콘텐츠 또는 에러 정보
 */
export async function crawlNewsContent(
  url: string,
  timeoutMs: number = 10000
): Promise<CrawledContent> {
  try {
    // URL 유효성 검증
    if (!url || !url.startsWith("http")) {
      return {
        title: "",
        content: "",
        success: false,
        error: "유효하지 않은 URL입니다.",
      };
    }

    // 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // HTML 가져오기
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          title: "",
          content: "",
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const html = await response.text();
      const $ = load(html);

      // 제목 추출 (여러 가능한 셀렉터 시도)
      let title =
        $("h2#title_area").text().trim() ||
        $("h3.media_end_head_headline").text().trim() ||
        $("h1").first().text().trim() ||
        $("title").text().trim();

      // 본문 추출 (Naver 뉴스: #newsct_article)
      let content =
        $("#newsct_article").text().trim() ||
        $("article").text().trim() ||
        $(".article_body").text().trim() ||
        $("main").text().trim() ||
        $("body").text().trim();

      // 불필요한 공백 정리
      content = content.replace(/\s+/g, " ").trim();

      if (!content || content.length < 50) {
        return {
          title: title || "",
          content: "",
          success: false,
          error: "본문을 추출할 수 없습니다. (너무 짧거나 셀렉터 불일치)",
        };
      }

      return {
        title: title || "",
        content,
        success: true,
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          return {
            title: "",
            content: "",
            success: false,
            error: "요청 시간 초과",
          };
        }
        return {
          title: "",
          content: "",
          success: false,
          error: `크롤링 실패: ${fetchError.message}`,
        };
      }

      return {
        title: "",
        content: "",
        success: false,
        error: "알 수 없는 오류가 발생했습니다.",
      };
    }
  } catch (error) {
    return {
      title: "",
      content: "",
      success: false,
      error:
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

/**
 * 여러 뉴스 URL을 일괄 크롤링합니다.
 * 
 * @param urls - 크롤링할 URL 배열
 * @param concurrency - 동시 실행 수 (기본값: 3)
 * @param timeoutMs - 타임아웃 시간 (밀리초, 기본값: 10000)
 * @returns 크롤링 결과 배열
 */
export async function crawlNewsContentBatch(
  urls: string[],
  concurrency: number = 3,
  timeoutMs: number = 10000
): Promise<CrawledContent[]> {
  const results: CrawledContent[] = [];

  // 동시 실행 제어를 위한 배치 처리
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url) => crawlNewsContent(url, timeoutMs))
    );
    results.push(...batchResults);

    // 배치 간 짧은 딜레이 (서버 부하 방지)
    if (i + concurrency < urls.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

