// 언론사 필터 유틸리티

import { TRUSTED_SOURCES, EXCLUDED_SOURCES } from "./constants.ts";
import type { NewsArticle } from "../types.ts";

/**
 * 언론사 이름에서 신뢰도 tier 추출
 */
function getSourceTier(sourceName: string): number | null {
  if (TRUSTED_SOURCES.tier1.includes(sourceName as any)) {
    return 1;
  }
  if (TRUSTED_SOURCES.tier2.includes(sourceName as any)) {
    return 2;
  }
  if (TRUSTED_SOURCES.tier3.includes(sourceName as any)) {
    return 3;
  }
  return null;
}

/**
 * 언론사 화이트리스트 필터
 * 화이트리스트에 있는 언론사만 통과
 */
export function filterBySource(news: NewsArticle[]): {
  passed: NewsArticle[];
  filtered: NewsArticle[];
  stats: {
    total: number;
    passed: number;
    filtered: number;
    tier1: number;
    tier2: number;
    tier3: number;
  };
} {
  const passed: NewsArticle[] = [];
  const filtered: NewsArticle[] = [];
  const stats = {
    total: news.length,
    passed: 0,
    filtered: 0,
    tier1: 0,
    tier2: 0,
    tier3: 0,
  };

  for (const item of news) {
    if (!item.source) {
      filtered.push(item);
      stats.filtered++;
      continue;
    }

    // 제외 언론사 체크
    if (EXCLUDED_SOURCES.includes(item.source as any)) {
      filtered.push(item);
      stats.filtered++;
      continue;
    }

    // 화이트리스트 체크
    const tier = getSourceTier(item.source);
    if (tier === null) {
      filtered.push(item);
      stats.filtered++;
      continue;
    }

    // 통과
    passed.push(item);
    stats.passed++;

    if (tier === 1) stats.tier1++;
    else if (tier === 2) stats.tier2++;
    else if (tier === 3) stats.tier3++;
  }

  return { passed, filtered, stats };
}

