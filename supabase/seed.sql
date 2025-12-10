-- 시드 데이터: 초기 데이터 입력
-- 생성일: 2025-12-10

-- 언론사 화이트리스트 데이터
INSERT INTO news_sources (name, domain, tier, credibility, is_active) VALUES
-- Tier 1: 통신사 (최고 신뢰도)
('연합뉴스', 'yna.co.kr', 1, 1.0, TRUE),
('뉴스1', 'news1.kr', 1, 1.0, TRUE),
('뉴시스', 'newsis.com', 1, 1.0, TRUE),

-- Tier 2: 경제 전문지
('한국경제', 'hankyung.com', 2, 0.9, TRUE),
('매일경제', 'mk.co.kr', 2, 0.9, TRUE),
('서울경제', 'sedaily.com', 2, 0.9, TRUE),
('머니투데이', 'mt.co.kr', 2, 0.9, TRUE),
('이데일리', 'edaily.co.kr', 2, 0.9, TRUE),
('파이낸셜뉴스', 'fnnews.com', 2, 0.9, TRUE),
('한국금융신문', 'fntimes.com', 2, 0.9, TRUE),

-- Tier 3: 종합 일간지
('조선일보', 'chosun.com', 3, 0.8, TRUE),
('중앙일보', 'joongang.co.kr', 3, 0.8, TRUE),
('동아일보', 'donga.com', 3, 0.8, TRUE),
('한겨레', 'hani.co.kr', 3, 0.8, TRUE),
('경향신문', 'khan.co.kr', 3, 0.8, TRUE)

ON CONFLICT (name) DO NOTHING;

-- 테스트용 종목 데이터 (선택사항 - 주석 해제하여 사용)
-- INSERT INTO stocks (code, name, market, sector, is_active) VALUES
-- ('005930', '삼성전자', 'KOSPI', '반도체', TRUE),
-- ('000660', 'SK하이닉스', 'KOSPI', '반도체', TRUE),
-- ('035420', 'NAVER', 'KOSPI', '인터넷', TRUE),
-- ('051910', 'LG화학', 'KOSPI', '화학', TRUE),
-- ('005380', '현대차', 'KOSPI', '자동차', TRUE)
-- ON CONFLICT (code) DO NOTHING;

