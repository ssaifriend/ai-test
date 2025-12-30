좋습니다! 그럼 **옵션 A-2 (권장안)**으로 확정하고, 최종 요구사항 명세서를 업데이트하겠습니다.

---

# 한국 주식 투자 리서치 AI Agent 시스템 - 최종 요구사항 명세서 v2.0

## 📋 프로젝트 개요

### 프로젝트명
Korean Stock Investment Research Agent System

### 목적
Multi-Agent 시스템을 활용하여 한국 주식 시장(NXT 거래 포함)의 실시간 투자 의견을 제공하고, 시간대별 차등 수집 전략으로 의견 변화를 추적하여 투자자에게 제공하는 시스템

### 주요 특징
- 5개 전문 Agent의 독립적 분석 및 토론
- 시간대별 차등 실시간 추적 (5분-30분)
- 고품질 뉴스 필터링 (언론사 화이트리스트, 중복 제거)
- 선택적 원문 수집 (중요 뉴스만)
- 100% 무료 인프라로 운영 가능
- 월 예상 비용: $33.68 (약 45,000원)

---

## 🎯 핵심 기능

### 1. Multi-Agent 투자 위원회

#### 1.1 Agent 구성
| Agent | 역할 | 분석 대상 | LLM 모델 | 캐시 전략 |
|-------|------|----------|----------|----------|
| Fundamental Agent | 재무 분석 전문가 | PER, PBR, ROE, 부채비율 | GPT-4o-mini | 90% (하루 1회 갱신) |
| Technical Agent | 기술적 분석 전문가 | 이동평균, RSI, MACD | GPT-4o-mini | 50% (주가 변동) |
| News Agent | 뉴스 감성 전문가 | 뉴스 감성, 트렌드 | GPT-4o-mini | 0% (항상 실행) |
| Macro Agent | 거시경제 전문가 | 경제 지표, 산업 트렌드 | GPT-4o-mini | 95% (하루 1회 갱신) |
| Risk Agent | 리스크 관리 전문가 | 변동성, 리스크 | GPT-4o-mini | 0% (항상 실행) |

#### 1.2 의사결정 프로세스
```
데이터 수집 (병렬, 캐싱 활용)
    ↓
Agent 분석 (병렬, 5개 동시 실행)
    ↓
의견 합의도 계산
    ↓
    ├─ 합의도 ≥ 70% → 토론 생략 (60% 케이스)
    │
    └─ 합의도 < 70% → 1라운드 토론 (40% 케이스)
          ↓
       최종 의견 종합 (조건부 모델 선택)
       ├─ 의견 충돌 크거나 중요 종목 → GPT-4o (20%)
       └─ 일반 케이스 → GPT-4o-mini (80%)
```

---

### 2. 시간대별 차등 뉴스 수집 전략

#### 2.1 수집 스케줄

```yaml
peak_hours:  # 핵심 장 시간
  time: "09:00-15:30"
  duration: "6.5시간"
  interval: "5분"
  runs_per_day: 78
  articles_per_stock: 50
  reason: "가장 활발한 거래 시간, 변동성 높음"
  
active_hours:  # 시장 시작/마감 시간
  time: "08:00-09:00, 15:30-20:00"
  duration: "5.5시간"
  interval: "15분"
  runs_per_day: 22
  articles_per_stock: 30
  reason: "NXT 거래 시간, 중요한 뉴스 발생"
  
off_hours:  # 장외 시간
  time: "20:00-08:00"
  duration: "12시간"
  interval: "30분"
  runs_per_day: 24
  articles_per_stock: 20
  reason: "해외 시장 영향, 밤샘 뉴스"
```

#### 2.2 일일 수집량

```
Peak:    78회 × 50개 × 10종목 = 39,000개
Active:  22회 × 30개 × 10종목 =  6,600개
Off:     24회 × 20개 × 10종목 =  4,800개
─────────────────────────────────────────
합계:    124회 × 평균 40.6개 = 50,400개/일
```

#### 2.3 네이버 API 사용량

```
API 호출 횟수:
- Peak:   78회 × 10종목 = 780회
- Active: 22회 × 10종목 = 220회
- Off:    24회 × 10종목 = 240회
─────────────────────────────────────
합계:     124회 × 10종목 = 1,240회/일

네이버 API 한도: 25,000회/일
사용률: 1,240 / 25,000 = 4.96%
여유도: 약 20배 ✅
```

---

### 3. 뉴스 품질 필터링 파이프라인

#### 3.1 언론사 화이트리스트

```typescript
const TRUSTED_SOURCES = {
  tier1: [  // 통신사 (최고 신뢰도)
    '연합뉴스',
    '뉴스1', 
    '뉴시스'
  ],
  
  tier2: [  // 경제 전문지
    '한국경제',
    '매일경제',
    '서울경제',
    '머니투데이',
    '이데일리',
    '파이낸셜뉴스',
    '한국금융신문'
  ],
  
  tier3: [  // 종합 일간지
    '조선일보',
    '중앙일보',
    '동아일보',
    '한겨레',
    '경향신문'
  ]
};

const EXCLUDED_SOURCES = [  // 제외 언론사
  '아시아경제',  // 클릭베이트 빈번
  '헤럴드경제',  // 품질 낮음
  '디지털데일리',
  // 추가 가능
];
```

**필터링 효과**: 100개 → 40개 (60% 제거)

#### 3.2 중복 제거 (Jaccard 유사도)

```typescript
function removeDuplicates(news: NewsItem[]): NewsItem[] {
  // 제목 기반 유사도 계산
  // 임계값: 80% 이상 유사하면 중복으로 판단
  
  예시:
  - "삼성전자 4분기 영업이익 6조원 기록"
  - "삼성전자, 4Q 영업익 6조... 시장 예상 상회"
  → 유사도 85% → 중복 제거
}
```

**필터링 효과**: 40개 → 20개 (50% 제거)

#### 3.3 클릭베이트 & 저품질 필터

```typescript
const clickbaitPatterns = [
  /속보/, /충격/, /긴급/, /대박/,
  /!\s*$/, /[?!]{2,}/,
  /주목|화제|폭발/,
];

const lowQualityIndicators = [
  description.length < 50,           // 너무 짧음
  /네티즌|댓글|반응/,                // 네티즌 반응 기사
  /~것으로 보인다/,                  // 추측성
  /관계자에 따르면/,                 // 익명 출처
];
```

**필터링 효과**: 20개 → 15개 (25% 제거)

#### 3.4 최종 필터링 통과율

```
입력: 100개
  ↓ 언론사 필터 (40% 통과)
40개
  ↓ 중복 제거 (50% 통과)
20개
  ↓ 품질 필터 (75% 통과)
15개 ← 최종 (15% 통과율)
```

---

### 4. 선택적 원문 수집 전략

#### 4.1 중요도 분류 기준

```typescript
function classifyImportance(news: NewsItem): 'high' | 'medium' | 'low' {
  const highKeywords = [
    '실적', '영업이익', '순이익', '매출', 'IR',
    '인수', '합병', 'M&A', '투자유치',
    '신제품', '출시', '론칭',
    '증설', '공장', '투자',
    '소송', '규제', '제재', '과징금'
  ];
  
  const mediumKeywords = [
    '계약', '협약', '파트너십',
    '수주', '공급',
    '특허', '기술',
    '임원', '인사'
  ];
  
  // 제목에 highKeywords 포함 → high
  // 제목에 mediumKeywords 포함 → medium
  // 그 외 → low
}
```

#### 4.2 시간대별 원문 수집 비율

```yaml
peak_hours:
  importance_threshold: 15%
  # 15개 뉴스 중 고중요도 약 2-3개만 원문 수집
  
active_hours:
  importance_threshold: 10%
  # 덜 중요한 시간대, 더 선별적
  
off_hours:
  importance_threshold: 5%
  # 야간은 최소한만
```

#### 4.3 원문 수집 & 구조화

```typescript
async function crawlAndStructure(url: string) {
  // 1. 원문 크롤링 (cheerio 사용)
  const html = await fetch(url);
  const $ = cheerio.load(html);
  const fullText = $('#newsct_article').text().trim();
  
  // 2. LLM으로 구조화 (원문은 버림, 저작권 안전)
  const structured = await llm.invoke(`
다음 뉴스의 핵심만 추출하세요 (원문 재생산 금지):

${fullText.substring(0, 3000)}

JSON:
{
  "summary": "핵심 요약 200자",
  "financialNumbers": ["6조원", "전년比 15% 증가"],
  "keyFacts": ["팩트1", "팩트2", "팩트3"],
  "futureOutlook": "향후 전망",
  "impact": "high" | "medium" | "low"
}
  `);
  
  return structured;  // 원문은 저장하지 않음
}
```

---

### 5. 뉴스 감성 분석

#### 5.1 배치 분석 (비용 절약)

```typescript
async function batchAnalyze(news: NewsItem[]) {
  // 50개씩 배치로 묶어서 한 번에 분석
  const batches = chunk(news, 50);
  
  for (const batch of batches) {
    const prompt = `
다음 ${batch.length}개 뉴스의 감성을 빠르게 분석하세요.

뉴스 목록:
${batch.map((n, i) => `[${i}] ${n.title}`).join('\n')}

JSON 배열로 반환:
[
  {"index": 0, "sentiment": "positive", "score": 0.8, "impact": "high"},
  {"index": 1, "sentiment": "neutral", "score": 0.0, "impact": "low"},
  ...
]
    `;
    
    const result = await llm.invoke(prompt);
    // 결과 매핑
  }
}
```

---

## 🗄️ 데이터베이스 설계

### 주요 테이블

#### stocks (종목 마스터)
```sql
CREATE TABLE stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,        -- '005930'
  name VARCHAR(100) NOT NULL,               -- '삼성전자'
  market VARCHAR(10) NOT NULL,              -- 'KOSPI' or 'KOSDAQ'
  sector VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### news_articles (뉴스)
```sql
CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID REFERENCES stocks(id),
  
  -- 기본 정보
  title TEXT NOT NULL,
  description TEXT,                        -- 요약 (네이버 API)
  source VARCHAR(100),
  url TEXT,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 원문 구조화 (고중요도만)
  full_content_summary TEXT,               -- 원문 요약 (200자)
  financial_numbers TEXT[],                -- ["6조원", "15% 증가"]
  key_facts TEXT[],                        -- 주요 사실
  future_outlook TEXT,                     -- 전망
  
  -- 중요도 & 필터링
  importance VARCHAR(10),                  -- 'high', 'medium', 'low'
  has_full_content BOOLEAN DEFAULT FALSE,
  filter_score DECIMAL(3, 2),              -- 0.0 ~ 1.0
  
  -- LLM 감성 분석
  sentiment VARCHAR(20),                   -- 'positive', 'negative', 'neutral'
  sentiment_score DECIMAL(3, 2),           -- -1.0 ~ 1.0
  key_topics TEXT[],                       -- ['실적', '반도체', 'AI']
  impact VARCHAR(10),                      -- 'high', 'medium', 'low'
  
  analyzed BOOLEAN DEFAULT FALSE,
  analysis_version VARCHAR(10),
  
  UNIQUE(stock_id, url)
);

CREATE INDEX idx_news_stock_time ON news_articles(stock_id, collected_at DESC);
CREATE INDEX idx_news_importance ON news_articles(stock_id, importance, collected_at DESC);
```

#### news_sources (언론사 관리)
```sql
CREATE TABLE news_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  domain VARCHAR(255),
  tier INTEGER,                            -- 1, 2, 3
  credibility DECIMAL(3, 2),               -- 0.0 ~ 1.0
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO news_sources (name, domain, tier, credibility) VALUES
('연합뉴스', 'yna.co.kr', 1, 1.0),
('한국경제', 'hankyung.com', 2, 0.9),
('매일경제', 'mk.co.kr', 2, 0.9);
-- ... 더 추가
```

#### investment_opinions (의견 히스토리)
```sql
CREATE TABLE investment_opinions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID REFERENCES stocks(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- 각 Agent 의견
  fundamental_rec VARCHAR(10),
  fundamental_confidence INTEGER,
  fundamental_reasoning TEXT[],
  
  technical_rec VARCHAR(10),
  technical_confidence INTEGER,
  technical_reasoning TEXT[],
  
  news_rec VARCHAR(10),
  news_confidence INTEGER,
  news_reasoning TEXT[],
  
  macro_rec VARCHAR(10),
  macro_confidence INTEGER,
  macro_reasoning TEXT[],
  
  risk_rec VARCHAR(10),
  risk_confidence INTEGER,
  risk_reasoning TEXT[],
  
  -- 토론 결과
  had_debate BOOLEAN DEFAULT FALSE,
  debate_summary TEXT,
  consensus_level INTEGER,                 -- 0-100
  
  -- 최종 의견
  final_rec VARCHAR(10) NOT NULL,
  final_confidence INTEGER NOT NULL,
  target_price INTEGER,
  stop_loss INTEGER,
  time_horizon VARCHAR(10),
  strategy TEXT,
  key_reasons TEXT[],
  risks TEXT[],
  
  -- 변화 추적
  changed_agents TEXT[],
  change_magnitude DECIMAL(5, 2),
  trigger_event TEXT,
  
  -- 메타 정보
  analysis_type VARCHAR(20),               -- 'full', 'quick'
  synthesis_model VARCHAR(50),             -- 'gpt-4o', 'gpt-4o-mini'
  cost_usd DECIMAL(10, 6),
  generation_time_ms INTEGER,
  used_cache BOOLEAN,
  news_count INTEGER,                      -- 분석에 사용된 뉴스 개수
  
  UNIQUE(stock_id, timestamp)
);

CREATE INDEX idx_opinions_stock_time ON investment_opinions(stock_id, timestamp DESC);
```

#### filtering_stats (필터링 통계)
```sql
CREATE TABLE filtering_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID REFERENCES stocks(id),
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  time_period VARCHAR(20),                 -- 'peak', 'active', 'off'
  
  raw_count INTEGER,                       -- 원본 개수
  after_source_filter INTEGER,             -- 언론사 필터 후
  after_dedup INTEGER,                     -- 중복 제거 후
  after_quality_filter INTEGER,            -- 품질 필터 후
  final_count INTEGER,                     -- 최종 개수
  high_importance_count INTEGER,           -- 고중요도 개수
  
  filter_rate DECIMAL(5, 2),               -- 전체 필터링 비율
  avg_similarity DECIMAL(5, 2)             -- 평균 유사도
);
```

#### llm_usage_logs (비용 추적)
```sql
CREATE TABLE llm_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  operation VARCHAR(50),                   -- 'sentiment', 'structure', 'agent', 'synthesis'
  model VARCHAR(50),                       -- 'gpt-4o-mini', 'gpt-4o'
  stock_id UUID REFERENCES stocks(id),
  
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  
  latency_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

CREATE INDEX idx_llm_logs_time ON llm_usage_logs(timestamp DESC);
CREATE INDEX idx_llm_logs_operation ON llm_usage_logs(operation, timestamp DESC);
```

---

## 🏗️ 시스템 아키텍처

### 인프라 구성

```
┌─────────────────────────────────────────┐
│  Frontend (Vercel + Next.js 14)        │
│  - App Router                           │
│  - TailwindCSS                          │
│  - Recharts                             │
│  - Supabase Realtime 구독               │
└──────────────┬──────────────────────────┘
               │ WebSocket + REST
               ▼
┌─────────────────────────────────────────┐
│  Supabase                               │
│  ├─ PostgreSQL (500MB)                  │
│  ├─ Realtime (WebSocket)                │
│  └─ Auth (선택사항)                      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  GitHub Actions (Cron Jobs)             │
│  ├─ 뉴스 수집 (시간대별 차등)             │
│  ├─ 필터링 파이프라인                    │
│  ├─ 감성 분석 & 원문 구조화              │
│  └─ Multi-Agent 분석                    │
└─────────────────────────────────────────┘
```

---

## 💻 프로젝트 구조

```
korean-stock-research-agent/
├── .github/
│   └── workflows/
│       ├── collect-news-peak.yml         # 핵심 시간 (5분)
│       ├── collect-news-active.yml       # 활동 시간 (15분)
│       ├── collect-news-off.yml          # 장외 시간 (30분)
│       └── multi-agent-analysis.yml      # Agent 분석
│
├── app/                                   # Next.js
│   ├── layout.tsx
│   ├── page.tsx                          # 대시보드
│   └── stock/
│       └── [code]/
│           ├── page.tsx
│           ├── multi-agent-tab.tsx
│           └── realtime-tracker-tab.tsx
│
├── components/
│   ├── AgentOpinionCard.tsx
│   ├── OpinionHistoryChart.tsx
│   ├── NewsTimelineChart.tsx
│   └── FilteringStatsPanel.tsx
│
├── lib/
│   ├── supabase.ts
│   ├── types.ts
│   └── constants.ts                      # 언론사 리스트 등
│
├── scripts/                               # Deno
│   ├── collect-news.ts
│   ├── filter-news.ts
│   ├── analyze-sentiment.ts
│   ├── multi-agent-analysis.ts
│   └── utils/
│       ├── deduplication.ts
│       ├── clickbait-detector.ts
│       └── importance-classifier.ts
│
├── agents/
│   ├── fundamental.agent.ts
│   ├── technical.agent.ts
│   ├── news.agent.ts
│   ├── macro.agent.ts
│   ├── risk.agent.ts
│   ├── debate.agent.ts
│   └── synthesis.agent.ts
│
├── services/
│   ├── smart-data-collector.ts           # 캐싱
│   ├── news-quality-filter.service.ts    # 필터링
│   ├── news-crawler.service.ts           # 원문 수집
│   ├── sentiment-analyzer.service.ts
│   └── supabase.service.ts
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_news_tables.sql
│   │   ├── 003_filtering_stats.sql
│   │   └── 004_llm_usage_logs.sql
│   │
│   └── seed.sql                          # 초기 데이터 (언론사 등)
│
├── package.json
├── deno.json
├── .env.example
└── README.md
```

---

## 🚀 개발 로드맵 (10주)

### Week 1-2: 인프라 & 기본 설정
- [ ] Supabase 프로젝트 생성 및 테이블 생성
- [ ] Next.js 프로젝트 셋업 (Vercel 배포)
- [ ] 네이버 API, OpenAI API 연동 테스트
- [ ] 언론사 화이트리스트 데이터 입력

### Week 3-4: 뉴스 수집 & 필터링 시스템
- [ ] 시간대별 GitHub Actions 스케줄러 설정
- [ ] 뉴스 수집 스크립트 (`collect-news.ts`)
- [ ] 필터링 파이프라인 구현
  - [ ] 언론사 필터
  - [ ] 중복 제거 (Jaccard 유사도)
  - [ ] 클릭베이트 필터
- [ ] 필터링 통계 수집
- [ ] 테스트: 하루 동안 실행하여 수집량/품질 확인

### Week 5: 원문 수집 & 구조화
- [ ] 중요도 분류기 구현 (`importance-classifier.ts`)
- [ ] 원문 크롤러 (cheerio)
- [ ] LLM 구조화 (`news-crawler.service.ts`)
- [ ] 저작권 안전 확인 (원문 저장 X)

### Week 6: 감성 분석
- [ ] 배치 감성 분석 (`sentiment-analyzer.service.ts`)
- [ ] 시간대별 집계 (5분/1시간/24시간) - 삭제 가능
- [ ] 감성 트렌드 계산

### Week 7-8: Multi-Agent 시스템
- [ ] 5개 Agent 구현
  - [ ] Fundamental Agent (캐싱 90%)
  - [ ] Technical Agent (캐싱 50%)
  - [ ] News Agent
  - [ ] Macro Agent (캐싱 95%)
  - [ ] Risk Agent
- [ ] Debate Agent (조건부 토론)
- [ ] Synthesis Agent (조건부 모델 선택)
- [ ] LangGraph Orchestrator
- [ ] 비용 로깅

### Week 9: Frontend 구현
- [ ] 대시보드 (관심 종목 목록)
- [ ] 종목 상세 페이지
  - [ ] Multi-Agent 분석 탭
  - [ ] 실시간 추적 탭 (차트)
  - [ ] 뉴스 타임라인
- [ ] Supabase Realtime 구독
- [ ] 필터링 통계 패널

### Week 10: 최적화 & 테스트
- [ ] 캐싱 전략 검증
- [ ] 비용 모니터링 대시보드
- [ ] 성능 최적화
- [ ] E2E 테스트
- [ ] 문서화

---

## 💰 월간 비용 명세 (최종)

### LLM 비용

```
일일 뉴스 수집:
- Peak: 39,000개 → 필터 후 5,850개
- Active: 6,600개 → 필터 후 990개
- Off: 4,800개 → 필터 후 720개
- 합계: 50,400개 → 7,560개/일

월간 (22일): 166,320개

─────────────────────────────────────

1. 뉴스 감성 분석 (GPT-4o-mini):
   - 배치: 166,320 / 50 = 3,327 배치
   - 비용: 3,327 × $0.002325 = $7.73

2. 원문 구조화 (GPT-4o-mini):
   - Peak: 5,850 × 0.15 = 878개/일
   - Active: 990 × 0.10 = 99개/일
   - Off: 720 × 0.05 = 36개/일
   - 월간: 1,013 × 22 = 22,286개
   - 비용: 22,286 × $0.00048 = $10.70

3. Agent 분석:
   - Fundamental: $0.09
   - Technical: $0.40
   - News: $1.57
   - Macro: $0.05
   - Risk: $0.89
   - 소계: $3.00

4. Debate (40% 케이스):
   - 비용: $0.84

5. Synthesis (조건부):
   - 80% GPT-4o-mini: $2.21
   - 20% GPT-4o: $9.21
   - 소계: $11.42

─────────────────────────────────────
총 LLM 비용: $33.68/월
```

### 인프라 비용

| 항목 | 사용량 | 무료 한도 | 비용 |
|------|--------|-----------|------|
| Vercel | ~2GB | 100GB | $0 |
| Supabase DB | ~400MB | 500MB | $0 |
| GitHub Actions | ~6,000분 | 무제한 | $0 |
| Naver API | 27,280회 | 550,000회 | $0 |

```
┌─────────────────────────────────────────┐
│         월간 총 비용                     │
├─────────────────────────────────────────┤
│  LLM 비용          $33.68               │
│  인프라 비용       $0.00                │
├─────────────────────────────────────────┤
│  합계              $33.68               │
│              (약 45,000원)              │
└─────────────────────────────────────────┘
```

---

## ⚙️ 환경 변수

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx...

# OpenAI
OPENAI_API_KEY=sk-proj-xxx...

# Naver
NAVER_CLIENT_ID=xxx
NAVER_CLIENT_SECRET=xxx
```

---

## 📊 성공 지표

### 시스템 성능
- 평균 실행 시간: **10초 이하**
- 캐시 hit율: **80% 이상**
- 필터링 통과율: **15% 목표**
- 가동률: **99% 이상**

### 비용
- 월 LLM 비용: **$33.68 이하**
- 인프라 비용: **$0**

### 데이터 품질
- 뉴스 수집 성공률: **95% 이상**
- 중복 제거율: **80% 이상**
- 감성 분석 일관성: **Agent 간 합의도 70% 이상**

---

## ⚠️ 주의사항

### 1. Supabase 저장 공간 관리

```
일일 뉴스: 7,560개 × 1KB = 7.5MB
월간: 7.5MB × 30 = 225MB
3개월: 225MB × 3 = 675MB

→ 500MB 한도 초과! ⚠️

해결책:
1. 2개월만 보관 (450MB, 안전)
2. 또는 매달 오래된 뉴스 삭제

SQL:
DELETE FROM news_articles 
WHERE collected_at < NOW() - INTERVAL '60 days';
```

### 2. 네이버 API 모니터링

```
하루 호출: 1,240회
한도: 25,000회
사용률: 5%

→ 안전하지만 주기적 확인 필요
```

### 3. 비용 초과 방지

```
비용 알림 설정:
- OpenAI Dashboard에서 $50 알림 설정
- 월 중순에 비용 확인
- $40 초과 시 원문 수집 비율 낮춤
```

---

## 📚 참고 문서

- [LangChain JS 공식 문서](https://js.langchain.com/docs)
- [Supabase 공식 문서](https://supabase.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [네이버 개발자센터](https://developers.naver.com/docs/search/news/)
- [OpenAI API](https://platform.openai.com/docs)

---

## ✅ 개발 시작 체크리스트

- [ ] Supabase 계정 생성
- [ ] OpenAI API 키 발급
- [ ] Naver API 신청 (승인 2-3일 소요)
- [ ] GitHub 레포지토리 생성 (Public)
- [ ] Vercel 계정 연결
- [ ] 로컬 개발 환경 셋업

---

**문서 버전**: 2.0 (최종)  
**최종 수정일**: 2025-12-10  
**예상 개발 기간**: 10주  
**예상 월 비용**: $33.68 (약 45,000원)
