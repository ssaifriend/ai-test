-- 뉴스 관련 테이블
-- 생성일: 2025-12-10

-- 언론사 관리 테이블
CREATE TABLE IF NOT EXISTS news_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  domain VARCHAR(255),
  tier INTEGER CHECK (tier IN (1, 2, 3)),
  credibility DECIMAL(3, 2) CHECK (credibility >= 0.0 AND credibility <= 1.0),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_news_sources_name ON news_sources(name);
CREATE INDEX IF NOT EXISTS idx_news_sources_tier ON news_sources(tier);
CREATE INDEX IF NOT EXISTS idx_news_sources_active ON news_sources(is_active) WHERE is_active = TRUE;

-- 뉴스 기사 테이블
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,

  -- 기본 정보
  title TEXT NOT NULL,
  description TEXT,
  source VARCHAR(100),
  url TEXT,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT NOW(),

  -- 원문 구조화 (고중요도만)
  full_content_summary TEXT,
  financial_numbers TEXT[],
  key_facts TEXT[],
  future_outlook TEXT,

  -- 중요도 & 필터링
  importance VARCHAR(10) CHECK (importance IN ('high', 'medium', 'low')),
  has_full_content BOOLEAN DEFAULT FALSE,
  filter_score DECIMAL(3, 2) CHECK (filter_score >= 0.0 AND filter_score <= 1.0),

  -- LLM 감성 분석
  sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  sentiment_score DECIMAL(3, 2) CHECK (sentiment_score >= -1.0 AND sentiment_score <= 1.0),
  key_topics TEXT[],
  impact VARCHAR(10) CHECK (impact IN ('high', 'medium', 'low')),

  analyzed BOOLEAN DEFAULT FALSE,
  analysis_version VARCHAR(10),

  UNIQUE(stock_id, url)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_news_stock_time ON news_articles(stock_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_importance ON news_articles(stock_id, importance, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_sentiment ON news_articles(stock_id, sentiment, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_analyzed ON news_articles(analyzed) WHERE analyzed = FALSE;
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_articles(published_at DESC);

