// 클릭베이트 및 저품질 뉴스 감지 유틸리티

import type { NewsArticle } from "../types.ts";

/**
 * 클릭베이트 패턴 정의 (극도로 완화 - 최소한만 필터링)
 */
const CLICKBAIT_PATTERNS = [
  /[?!]{5,}/, // 물음표나 느낌표 5개 이상만 필터링
];

/**
 * 저품질 뉴스 지표 (극도로 완화 - 거의 필터링 안함)
 */
function isLowQuality(news: NewsArticle): boolean {
  // 제목이 극도로 짧은 경우만 (5자 미만)
  if (news.title.length < 5) {
    return true;
  }

  return false;
}

/**
 * 클릭베이트 감지
 */
function isClickbait(title: string): boolean {
  return CLICKBAIT_PATTERNS.some((pattern) => pattern.test(title));
}

/**
 * 클릭베이트 및 저품질 뉴스 필터링
 */
export function filterClickbaitAndLowQuality(news: NewsArticle[]): {
  passed: NewsArticle[];
  filtered: NewsArticle[];
  stats: {
    total: number;
    passed: number;
    filtered: number;
    clickbait: number;
    lowQuality: number;
  };
} {
  const passed: NewsArticle[] = [];
  const filtered: NewsArticle[] = [];
  const stats = {
    total: news.length,
    passed: 0,
    filtered: 0,
    clickbait: 0,
    lowQuality: 0,
  };

  for (const item of news) {
    let shouldFilter = false;
    let filterReason: "clickbait" | "lowQuality" | null = null;

    // 클릭베이트 체크
    if (isClickbait(item.title)) {
      shouldFilter = true;
      filterReason = "clickbait";
      stats.clickbait++;
    }

    // 저품질 체크 (클릭베이트가 아니어도)
    if (!shouldFilter && isLowQuality(item)) {
      shouldFilter = true;
      filterReason = "lowQuality";
      stats.lowQuality++;
    }

    if (shouldFilter) {
      filtered.push(item);
      stats.filtered++;
    } else {
      passed.push(item);
      stats.passed++;
    }
  }

  return { passed, filtered, stats };
}

