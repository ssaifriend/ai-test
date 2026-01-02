-- current_price 제약 조건 수정
-- 가격 정보가 없을 때 NULL을 허용하도록 변경

-- 기존 제약 조건 삭제
ALTER TABLE public.investment_opinions
DROP CONSTRAINT IF EXISTS investment_opinions_current_price_check;

-- 새 제약 조건 추가 (NULL 허용)
ALTER TABLE public.investment_opinions
ADD CONSTRAINT investment_opinions_current_price_check
CHECK (current_price IS NULL OR current_price > 0);

-- 코멘트 업데이트
COMMENT ON COLUMN public.investment_opinions.current_price IS '의견 생성 시점의 현재 주가 (원, NULL 허용)';
