# 한국 주식 투자 리서치 AI Agent 시스템

Multi-Agent 시스템을 활용하여 한국 주식 시장(NXT 거래 포함)의 실시간 투자 의견을 제공하는 시스템입니다.

## 🎯 주요 기능

- **5개 전문 Agent의 독립적 분석 및 토론**
  - Fundamental Agent: 재무 분석 전문가
  - Technical Agent: 기술적 분석 전문가
  - News Agent: 뉴스 감성 전문가
  - Macro Agent: 거시경제 전문가
  - Risk Agent: 리스크 관리 전문가

- **시간대별 차등 실시간 추적** (5분-30분)
- **고품질 뉴스 필터링** (언론사 화이트리스트, 중복 제거)
- **선택적 원문 수집** (중요 뉴스만)
- **100% 무료 인프라로 운영 가능**

## 🏗️ 기술 스택

### Frontend
- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- Recharts
- Supabase Realtime

### Backend / Scripts
- Deno
- Supabase (PostgreSQL)
- OpenAI API (GPT-4o-mini, GPT-4o)
- Naver News API

### Infrastructure
- Vercel (Frontend 배포)
- Supabase (Database)
- GitHub Actions (Cron Jobs)

## 📁 프로젝트 구조

```
korean-stock-research-agent/
├── frontend/          # Next.js 프로젝트
├── scripts/           # Deno 스크립트 (뉴스 수집, 분석 등)
├── agents/            # Multi-Agent 시스템
├── services/          # 서비스 레이어
├── supabase/          # 데이터베이스 마이그레이션
└── docs/              # 문서
```

## 🚀 시작하기

### 사전 요구사항

- Node.js 18+ 
- Deno 1.38+
- Supabase 계정
- OpenAI API 키
- Naver API 키

### 설치

1. **저장소 클론**
```bash
git clone <repository-url>
cd korean-stock-research-agent
```

2. **환경 변수 설정**
```bash
# 루트 .env 파일 생성 (서버 사이드 스크립트용)
cp .env.example .env
# .env 파일을 열어서 실제 값으로 수정하세요

# frontend/.env.local 파일 생성 (클라이언트 사이드용)
cd frontend
cp .env.local.example .env.local
# .env.local 파일을 열어서 실제 값으로 수정하세요
```

**필요한 환경 변수:**
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_KEY`: Supabase Service Role Key (서버 사이드 전용)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL (클라이언트용)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key (클라이언트용)
- `OPENAI_API_KEY`: OpenAI API 키
- `NAVER_CLIENT_ID`: Naver API 클라이언트 ID
- `NAVER_CLIENT_SECRET`: Naver API 클라이언트 Secret

3. **Frontend 의존성 설치**
```bash
cd frontend
yarn install
```

> **Zero-install 모드**: 이 프로젝트는 Yarn Berry의 zero-install을 사용합니다. `.yarn/cache`에 패키지가 저장되어 있어 `yarn install` 없이도 바로 실행 가능합니다.

4. **개발 서버 실행**
```bash
yarn dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 📚 문서

- [요구사항 명세서](./docs/REQUIREMENTS.md)
- [작업 계획서](./docs/WORK_PLAN.md)

## 📝 개발 가이드

자세한 개발 가이드는 [AGENTS.md](./AGENTS.md)를 참고하세요.

## 📄 라이선스

MIT License

