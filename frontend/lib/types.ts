// 공유 타입 정의

export interface Stock {
  id: string;
  code: string;
  name: string;
  market: "KOSPI" | "KOSDAQ";
  sector?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewsArticle {
  id: string;
  stock_id: string;
  title: string;
  description?: string;
  source?: string;
  url?: string;
  published_at?: string;
  collected_at: string;
  full_content_summary?: string;
  financial_numbers?: string[];
  key_facts?: string[];
  future_outlook?: string;
  importance?: "high" | "medium" | "low";
  has_full_content: boolean;
  filter_score?: number;
  sentiment?: "positive" | "negative" | "neutral";
  sentiment_score?: number;
  key_topics?: string[];
  impact?: "high" | "medium" | "low";
  analyzed: boolean;
  analysis_version?: string;
}

export interface InvestmentOpinion {
  id: string;
  stock_id: string;
  timestamp: string;
  fundamental_rec?: string;
  fundamental_confidence?: number;
  fundamental_reasoning?: string[];
  technical_rec?: string;
  technical_confidence?: number;
  technical_reasoning?: string[];
  news_rec?: string;
  news_confidence?: number;
  news_reasoning?: string[];
  macro_rec?: string;
  macro_confidence?: number;
  macro_reasoning?: string[];
  risk_rec?: string;
  risk_confidence?: number;
  risk_reasoning?: string[];
  had_debate: boolean;
  debate_summary?: string;
  consensus_level?: number;
  final_rec: string;
  final_confidence: number;
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  strategy?: string;
  key_reasons?: string[];
  risks?: string[];
  changed_agents?: string[];
  change_magnitude?: number;
  trigger_event?: string;
  analysis_type?: string;
  synthesis_model?: string;
  cost_usd?: number;
  generation_time_ms?: number;
  used_cache?: boolean;
  news_count?: number;
}

