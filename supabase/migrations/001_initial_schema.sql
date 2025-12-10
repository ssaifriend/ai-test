-- 초기 스키마: 종목 마스터 테이블
-- 생성일: 2025-12-10

-- 종목 마스터 테이블
CREATE TABLE IF NOT EXISTS stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  market VARCHAR(10) NOT NULL CHECK (market IN ('KOSPI', 'KOSDAQ')),
  sector VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_stocks_code ON stocks(code);
CREATE INDEX IF NOT EXISTS idx_stocks_market ON stocks(market);
CREATE INDEX IF NOT EXISTS idx_stocks_active ON stocks(is_active) WHERE is_active = TRUE;

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
CREATE TRIGGER update_stocks_updated_at
  BEFORE UPDATE ON stocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 테스트용 종목 데이터 (선택사항)
-- INSERT INTO stocks (code, name, market, sector) VALUES
-- ('005930', '삼성전자', 'KOSPI', '반도체'),
-- ('000660', 'SK하이닉스', 'KOSPI', '반도체');

