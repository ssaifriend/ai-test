# Supabase 데이터베이스 설정 가이드

## 마이그레이션 실행 방법

### 1. Supabase CLI 설치

```bash
# npm을 통해 설치
npm install -g supabase

# 또는 Homebrew (macOS)
brew install supabase/tap/supabase
```

### 2. Supabase 프로젝트 로그인

```bash
supabase login
```

### 3. 프로젝트 링크

```bash
# Supabase 대시보드에서 프로젝트 설정 > API > Project URL과 anon key 확인
supabase link --project-ref your-project-ref
```

### 4. 마이그레이션 실행

#### 방법 1: Supabase CLI 사용 (권장)

```bash
# 모든 마이그레이션 실행
supabase db push

# 또는 특정 마이그레이션만 실행
supabase migration up
```

#### 방법 2: Supabase 대시보드 사용

1. Supabase 대시보드 접속
2. SQL Editor 메뉴로 이동
3. 각 마이그레이션 파일의 내용을 순서대로 실행:
   - `001_initial_schema.sql`
   - `002_news_tables.sql`
   - `003_filtering_stats.sql`
   - `004_llm_usage_logs.sql`
   - `005_investment_opinions.sql`

### 5. 시드 데이터 입력

```bash
# Supabase CLI 사용
supabase db reset --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" < supabase/seed.sql

# 또는 Supabase 대시보드 SQL Editor에서 직접 실행
```

## 마이그레이션 파일 순서

1. **001_initial_schema.sql**: 기본 테이블 (stocks)
2. **002_news_tables.sql**: 뉴스 관련 테이블 (news_sources, news_articles)
3. **003_filtering_stats.sql**: 필터링 통계 테이블
4. **004_llm_usage_logs.sql**: LLM 사용 로그 테이블
5. **005_investment_opinions.sql**: 투자 의견 테이블

## 환경 변수 설정

마이그레이션 실행 후 다음 환경 변수를 설정하세요:

```bash
# .env 파일
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# frontend/.env.local 파일
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Realtime 활성화

Supabase 대시보드에서 다음 테이블의 Realtime을 활성화하세요:

1. `investment_opinions` 테이블
2. `news_articles` 테이블

**방법:**
- Database > Replication 메뉴로 이동
- 각 테이블의 Realtime 토글 활성화

## 테이블 구조 확인

마이그레이션 실행 후 다음 명령어로 테이블 구조를 확인할 수 있습니다:

```bash
supabase db diff
```
