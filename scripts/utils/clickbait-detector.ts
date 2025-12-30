// 클릭베이트 및 저품질 뉴스 감지 유틸리티

import type { NewsArticle } from "../types.ts";

/**
 * 클릭베이트 패턴 정의 (보수적으로 조정)
 */
const CLICKBAIT_PATTERNS = [
  /충격/, // "충격" 키워드
  /대박/, // "대박" 키워드
  /[?!]{3,}/, // 물음표나 느낌표 3개 이상
  /믿을 수 없는/, // "믿을 수 없는" 키워드
  /이것만 알면/, // "이것만 알면" 키워드
  /숨겨진 진실/, // "숨겨진 진실" 키워드
  /클릭/, // "클릭" 키워드
];

/**
 * 저품질 뉴스 지표 (완화됨)
 */
function isLowQuality(news: NewsArticle): boolean {
  // 설명이 너무 짧음 (30자 미만)
  if (news.description && news.description.length < 30) {
    return true;
  }

  // 네티즌 반응 중심 기사 (제목에 명확히 드러나는 경우만)
  if (news.title.match(/네티즌 반응|댓글 폭발|누리꾼 분노/)) {
    return true;
  }

  // 제목이 너무 짧거나 너무 긺
  if (news.title.length < 10 || news.title.length > 150) {
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

