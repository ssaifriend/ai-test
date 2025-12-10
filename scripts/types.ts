// 공유 타입 정의 (스크립트용)

export interface NewsItem {
  title: string;
  description?: string;
  originallink?: string;
  link: string;
  pubDate: string;
}

export interface NaverNewsResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NewsItem[];
}

export interface Stock {
  id: string;
  code: string;
  name: string;
  market: "KOSPI" | "KOSDAQ";
  sector?: string;
  is_active: boolean;
}

export interface NewsArticle {
  id?: string;
  stock_id: string;
  title: string;
  description?: string;
  source?: string;
  url?: string;
  published_at?: string;
  collected_at?: string;
  importance?: "high" | "medium" | "low";
  has_full_content: boolean;
  filter_score?: number;
  sentiment?: "positive" | "negative" | "neutral";
  sentiment_score?: number;
  key_topics?: string[];
  impact?: "high" | "medium" | "low";
  analyzed: boolean;
}

