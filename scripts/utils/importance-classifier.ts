/**
 * 뉴스 중요도 분류 유틸리티
 * 
 * 필터링을 통과한 뉴스 중에서 원문 수집이 필요한 뉴스를 선별합니다.
 * High: 원문 수집 및 구조화 필요
 * Medium: 원문 수집 필요 (구조화는 선택적)
 * Low: 원문 수집 불필요
 */

export type ImportanceLevel = "high" | "medium" | "low";

interface NewsItem {
  title: string;
  description?: string;
}

// High 중요도 키워드: 원문 수집 및 구조화 필수
const HIGH_KEYWORDS = [
  "실적",
  "영업이익",
  "순이익",
  "매출",
  "IR",
  "인수",
  "합병",
  "M&A",
  "투자유치",
  "신제품",
  "출시",
  "론칭",
  "증설",
  "공장",
  "투자",
  "소송",
  "규제",
  "제재",
  "과징금",
];

// Medium 중요도 키워드: 원문 수집 권장
const MEDIUM_KEYWORDS = [
  "계약",
  "협약",
  "파트너십",
  "수주",
  "공급",
  "특허",
  "기술",
  "임원",
  "인사",
  "임원진",
  "CEO",
  "CFO",
  "CTO",
  "주주",
  "배당",
  "자사주",
  "매각",
  "매입",
  "지분",
  "증자",
  "감자",
  "상장",
  "상장폐지",
  "정지",
  "경고",
];

/**
 * 뉴스의 중요도를 분류합니다.
 * 
 * @param news - 분류할 뉴스 아이템 (title, description 포함)
 * @returns 중요도 레벨 ('high' | 'medium' | 'low')
 */
export function classifyImportance(news: NewsItem): ImportanceLevel {
  const text = `${news.title} ${news.description || ""}`.toLowerCase();

  // High 키워드 확인
  for (const keyword of HIGH_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return "high";
    }
  }

  // Medium 키워드 확인
  for (const keyword of MEDIUM_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return "medium";
    }
  }

  // 키워드가 없으면 Low
  return "low";
}

/**
 * 여러 뉴스의 중요도를 일괄 분류합니다.
 * 
 * @param newsItems - 분류할 뉴스 아이템 배열
 * @returns 중요도 레벨 배열
 */
export function classifyImportanceBatch(
  newsItems: NewsItem[]
): ImportanceLevel[] {
  return newsItems.map(classifyImportance);
}

