-- 초기 종목 데이터 삽입
-- 생성일: 2025-12-30

-- 5개 종목 추가
INSERT INTO stocks (code, name, market, sector, is_active) VALUES
  ('005930', '삼성전자', 'KOSPI', '반도체', true),
  ('000660', 'SK하이닉스', 'KOSPI', '반도체', true),
  ('402340', 'SK스퀘어', 'KOSPI', 'IT서비스', true),
  ('001440', '대한전선', 'KOSPI', '전기전자', true),
  ('012450', '한화에어로스페이스', 'KOSPI', '항공우주', true)
ON CONFLICT (code) DO NOTHING;
