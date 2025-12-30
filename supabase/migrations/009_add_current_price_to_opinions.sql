-- 투자 의견에 현재가 추가
-- 의견 생성 시점의 주가를 기록하여 목표가와 비교 가능

ALTER TABLE public.investment_opinions
ADD COLUMN IF NOT EXISTS current_price INTEGER CHECK (current_price > 0);

-- 코멘트 추가
COMMENT ON COLUMN public.investment_opinions.current_price IS '의견 생성 시점의 현재 주가 (원)';
COMMENT ON COLUMN public.investment_opinions.target_price IS '목표 주가 (원)';
COMMENT ON COLUMN public.investment_opinions.stop_loss IS '손절가 (원)';
