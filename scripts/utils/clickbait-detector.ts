// 클릭베이트 및 저품질 뉴스 감지 유틸리티

import type { NewsArticle } from "../types.ts";

/**
 * 클릭베이트 패턴 정의
 */
const CLICKBAIT_PATTERNS = [
  /속보/,
  /충격/,
  /긴급/,
  /대박/,
  /!\s*$/,
  /[?!]{2,}/,
  /주목|화제|폭발/,
  /놀라운|믿을 수 없는/,
  /이것만 알면/,
  /숨겨진 진실/,
];

/**
 * 저품질 뉴스 지표
 */
function isLowQuality(news: NewsArticle): boolean {
  // 설명이 너무 짧음
  if (news.description && news.description.length < 50) {
    return true;
  }

  // 네티즌 반응 기사
  if (news.title.match(/네티즌|댓글|반응|누리꾼/)) {
    return true;
  }

  // 추측성 표현
  if (news.title.match(/것으로 보인다|것으로 추정|것으로 전망/)) {
    return true;
  }

  // 익명 출처
  if (news.description?.match(/관계자에 따르면|익명의 관계자/)) {
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

