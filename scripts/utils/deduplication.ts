// 중복 제거 유틸리티 (Jaccard 유사도 기반)

import type { NewsArticle } from "../types.ts";

/**
 * 문자열을 단어 집합으로 변환
 */
function tokenize(text: string): Set<string> {
  // 한글, 영문, 숫자만 추출하고 소문자로 변환
  const words = text
    .toLowerCase()
    .replace(/[^\w가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);
  return new Set(words);
}

/**
 * Jaccard 유사도 계산
 * 두 집합의 교집합 크기 / 합집합 크기
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) {
    return 0;
  }

  return intersection.size / union.size;
}

/**
 * 뉴스 제목 기반 중복 제거
 * 임계값 80% 이상 유사하면 중복으로 판단
 */
export function removeDuplicates(
  news: NewsArticle[],
  threshold: number = 0.8
): {
  unique: NewsArticle[];
  duplicates: NewsArticle[];
  stats: {
    total: number;
    unique: number;
    duplicates: number;
    avgSimilarity: number;
  };
} {
  const unique: NewsArticle[] = [];
  const duplicates: NewsArticle[] = [];
  const similarities: number[] = [];

  for (let i = 0; i < news.length; i++) {
    const current = news[i];
    const currentTokens = tokenize(current.title);

    let isDuplicate = false;
    let maxSimilarity = 0;

    // 이미 unique에 추가된 뉴스와 비교
    for (const existing of unique) {
      const existingTokens = tokenize(existing.title);
      const similarity = jaccardSimilarity(currentTokens, existingTokens);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }

      if (similarity >= threshold) {
        isDuplicate = true;
        break;
      }
    }

    similarities.push(maxSimilarity);

    if (isDuplicate) {
      duplicates.push(current);
    } else {
      unique.push(current);
    }
  }

  const avgSimilarity =
    similarities.length > 0
      ? similarities.reduce((sum, s) => sum + s, 0) / similarities.length
      : 0;

  return {
    unique,
    duplicates,
    stats: {
      total: news.length,
      unique: unique.length,
      duplicates: duplicates.length,
      avgSimilarity: Math.round(avgSimilarity * 100) / 100,
    },
  };
}

