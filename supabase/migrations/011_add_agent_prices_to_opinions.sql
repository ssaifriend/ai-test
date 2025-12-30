-- 투자 의견에 각 Agent별 목표가/손절가 추가
-- 각 Agent가 제안한 목표가와 손절가를 기록하여 투명성 향상

ALTER TABLE public.investment_opinions
ADD COLUMN IF NOT EXISTS fundamental_target_price INTEGER,
ADD COLUMN IF NOT EXISTS fundamental_stop_loss INTEGER,
ADD COLUMN IF NOT EXISTS technical_target_price INTEGER,
ADD COLUMN IF NOT EXISTS technical_stop_loss INTEGER;

-- 코멘트 추가
COMMENT ON COLUMN public.investment_opinions.fundamental_target_price IS 'Fundamental Agent 제안 목표가 (원)';
COMMENT ON COLUMN public.investment_opinions.fundamental_stop_loss IS 'Fundamental Agent 제안 손절가 (원)';
COMMENT ON COLUMN public.investment_opinions.technical_target_price IS 'Technical Agent 제안 목표가 (원)';
COMMENT ON COLUMN public.investment_opinions.technical_stop_loss IS 'Technical Agent 제안 손절가 (원)';
