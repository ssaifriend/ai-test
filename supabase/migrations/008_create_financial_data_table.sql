-- 재무 데이터 테이블 생성
-- 종목별 재무 데이터를 저장하여 1시간 주기로 재사용

CREATE TABLE IF NOT EXISTS public.financial_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  stock_code TEXT NOT NULL,

  -- 재무 지표
  per DECIMAL(10, 2),           -- 주가수익비율
  pbr DECIMAL(10, 2),           -- 주가순자산비율
  roe DECIMAL(10, 2),           -- 자기자본이익률 (%)
  debt_ratio DECIMAL(10, 2),    -- 부채비율 (%)
  current_ratio DECIMAL(10, 2), -- 유동비율

  -- 재무제표 데이터
  revenue BIGINT,               -- 매출액 (원)
  operating_profit BIGINT,      -- 영업이익 (원)
  net_profit BIGINT,            -- 순이익 (원)

  -- 메타 정보
  data_source TEXT,             -- 데이터 출처 (dart, naver, etc.)
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_stock_financial UNIQUE(stock_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_financial_data_stock_id ON public.financial_data(stock_id);
CREATE INDEX IF NOT EXISTS idx_financial_data_stock_code ON public.financial_data(stock_code);
CREATE INDEX IF NOT EXISTS idx_financial_data_updated_at ON public.financial_data(updated_at);

-- RLS 정책 설정
ALTER TABLE public.financial_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.financial_data
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow read for authenticated users" ON public.financial_data
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read for anon users" ON public.financial_data
  FOR SELECT
  TO anon
  USING (true);

-- 자동 updated_at 업데이트 트리거
CREATE OR REPLACE FUNCTION update_financial_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_financial_data_updated_at_trigger
  BEFORE UPDATE ON public.financial_data
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_data_updated_at();

-- 코멘트
COMMENT ON TABLE public.financial_data IS '종목별 재무 데이터 (1시간 주기 업데이트)';
COMMENT ON COLUMN public.financial_data.per IS 'PER (주가수익비율): 10-20 적정, 20+ 고평가, 10- 저평가';
COMMENT ON COLUMN public.financial_data.pbr IS 'PBR (주가순자산비율): 1.0- 저평가, 2.0+ 고평가';
COMMENT ON COLUMN public.financial_data.roe IS 'ROE (자기자본이익률): 15%+ 우수, 10%- 개선 필요';
COMMENT ON COLUMN public.financial_data.debt_ratio IS '부채비율: 100%- 양호, 200%+ 위험';
COMMENT ON COLUMN public.financial_data.current_ratio IS '유동비율: 100%+ 양호, 200%+ 우수';
