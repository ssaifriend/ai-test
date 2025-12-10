-- 필터링 통계 테이블
-- 생성일: 2025-12-10

CREATE TABLE IF NOT EXISTS filtering_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  time_period VARCHAR(20) CHECK (time_period IN ('peak', 'active', 'off')),

  raw_count INTEGER NOT NULL CHECK (raw_count >= 0),
  after_source_filter INTEGER NOT NULL CHECK (after_source_filter >= 0),
  after_dedup INTEGER NOT NULL CHECK (after_dedup >= 0),
  after_quality_filter INTEGER NOT NULL CHECK (after_quality_filter >= 0),
  final_count INTEGER NOT NULL CHECK (final_count >= 0),
  high_importance_count INTEGER NOT NULL CHECK (high_importance_count >= 0),

  filter_rate DECIMAL(5, 2) CHECK (filter_rate >= 0.0 AND filter_rate <= 100.0),
  avg_similarity DECIMAL(5, 2) CHECK (avg_similarity >= 0.0 AND avg_similarity <= 100.0)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_filtering_stats_stock_time ON filtering_stats(stock_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_filtering_stats_time_period ON filtering_stats(time_period, collected_at DESC);

