-- stocks 테이블에 DART 법인코드 추가
-- DART API는 종목코드가 아닌 법인코드를 사용하므로 매핑 필요

ALTER TABLE public.stocks
ADD COLUMN IF NOT EXISTS corp_code TEXT;

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_stocks_corp_code ON public.stocks(corp_code);

-- 코멘트 추가
COMMENT ON COLUMN public.stocks.corp_code IS 'DART API용 법인코드 (8자리)';
