# Supabase 마이그레이션

이 디렉토리는 Supabase 데이터베이스 마이그레이션 파일을 저장합니다.

## 구조

```
supabase/
├── migrations/          # 마이그레이션 SQL 파일
│   ├── 001_initial_schema.sql
│   ├── 002_news_tables.sql
│   ├── 003_filtering_stats.sql
│   ├── 004_llm_usage_logs.sql
│   └── 005_investment_opinions.sql
└── seed.sql            # 초기 시드 데이터
```

## 마이그레이션 실행 순서

마이그레이션 파일은 번호 순서대로 실행되어야 합니다.

1. `001_initial_schema.sql` - 기본 스키마 (stocks 테이블)
2. `002_news_tables.sql` - 뉴스 관련 테이블
3. `003_filtering_stats.sql` - 필터링 통계 테이블
4. `004_llm_usage_logs.sql` - LLM 사용 로그 테이블
5. `005_investment_opinions.sql` - 투자 의견 테이블

## 시드 데이터

`seed.sql` 파일에는 초기 데이터가 포함되어 있습니다:
- 언론사 화이트리스트 데이터
- 테스트용 종목 데이터

