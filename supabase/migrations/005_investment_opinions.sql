-- 투자 의견 히스토리 테이블
-- 생성일: 2025-12-10

CREATE TABLE IF NOT EXISTS investment_opinions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- 각 Agent 의견
  fundamental_rec VARCHAR(10) CHECK (fundamental_rec IN ('buy', 'sell', 'hold')),
  fundamental_confidence INTEGER CHECK (fundamental_confidence >= 0 AND fundamental_confidence <= 100),
  fundamental_reasoning TEXT[],

  technical_rec VARCHAR(10) CHECK (technical_rec IN ('buy', 'sell', 'hold')),
  technical_confidence INTEGER CHECK (technical_confidence >= 0 AND technical_confidence <= 100),
  technical_reasoning TEXT[],

  news_rec VARCHAR(10) CHECK (news_rec IN ('buy', 'sell', 'hold')),
  news_confidence INTEGER CHECK (news_confidence >= 0 AND news_confidence <= 100),
  news_reasoning TEXT[],

  macro_rec VARCHAR(10) CHECK (macro_rec IN ('buy', 'sell', 'hold')),
  macro_confidence INTEGER CHECK (macro_confidence >= 0 AND macro_confidence <= 100),
  macro_reasoning TEXT[],

  risk_rec VARCHAR(10) CHECK (risk_rec IN ('buy', 'sell', 'hold')),
  risk_confidence INTEGER CHECK (risk_confidence >= 0 AND risk_confidence <= 100),
  risk_reasoning TEXT[],

  -- 토론 결과
  had_debate BOOLEAN DEFAULT FALSE,
  debate_summary TEXT,
  consensus_level INTEGER CHECK (consensus_level >= 0 AND consensus_level <= 100),

  -- 최종 의견
  final_rec VARCHAR(10) NOT NULL CHECK (final_rec IN ('buy', 'sell', 'hold')),
  final_confidence INTEGER NOT NULL CHECK (final_confidence >= 0 AND final_confidence <= 100),
  target_price INTEGER CHECK (target_price > 0),
  stop_loss INTEGER CHECK (stop_loss > 0),
  time_horizon VARCHAR(10),
  strategy TEXT,
  key_reasons TEXT[],
  risks TEXT[],

  -- 변화 추적
  changed_agents TEXT[],
  change_magnitude DECIMAL(5, 2),
  trigger_event TEXT,

  -- 메타 정보
  analysis_type VARCHAR(20) CHECK (analysis_type IN ('full', 'quick')),
  synthesis_model VARCHAR(50),
  cost_usd DECIMAL(10, 6) CHECK (cost_usd >= 0),
  generation_time_ms INTEGER CHECK (generation_time_ms >= 0),
  used_cache BOOLEAN DEFAULT FALSE,
  news_count INTEGER CHECK (news_count >= 0),

  UNIQUE(stock_id, timestamp)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_opinions_stock_time ON investment_opinions(stock_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_opinions_final_rec ON investment_opinions(stock_id, final_rec, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_opinions_consensus ON investment_opinions(stock_id, consensus_level, timestamp DESC);

