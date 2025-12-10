-- LLM 사용 로그 테이블 (비용 추적)
-- 생성일: 2025-12-10

CREATE TABLE IF NOT EXISTS llm_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  operation VARCHAR(50) NOT NULL CHECK (operation IN ('sentiment', 'structure', 'agent', 'synthesis', 'debate')),
  model VARCHAR(50) NOT NULL,
  stock_id UUID REFERENCES stocks(id) ON DELETE SET NULL,

  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  cost_usd DECIMAL(10, 6) NOT NULL CHECK (cost_usd >= 0),

  latency_ms INTEGER CHECK (latency_ms >= 0),
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_llm_logs_time ON llm_usage_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_llm_logs_operation ON llm_usage_logs(operation, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_llm_logs_stock ON llm_usage_logs(stock_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_llm_logs_model ON llm_usage_logs(model, timestamp DESC);

