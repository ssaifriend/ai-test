# 배포 가이드

## 사전 준비

### 1. Supabase 프로젝트 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트 설정 > API에서 다음 정보 확인:
   - Project URL
   - `anon` key (Public)
   - `service_role` key (Secret)

### 2. 데이터베이스 마이그레이션 실행

자세한 내용은 [supabase/README.md](../supabase/README.md)를 참고하세요.

```bash
# Supabase CLI 설치
npm install -g supabase

# 프로젝트 링크
supabase link --project-ref your-project-ref

# 마이그레이션 실행
supabase db push
```

또는 Supabase 대시보드의 SQL Editor에서 마이그레이션 파일을 순서대로 실행하세요.

### 3. Realtime 활성화

Supabase 대시보드에서:
1. Database > Replication 메뉴로 이동
2. 다음 테이블의 Realtime 활성화:
   - `investment_opinions`
   - `news_articles`

### 4. GitHub Secrets 설정

GitHub 저장소 설정 > Secrets and variables > Actions에서 다음 secrets 추가:

#### 필수 Secrets

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ACCESS_TOKEN=your-supabase-access-token
SUPABASE_PROJECT_REF=your-project-ref
OPENAI_API_KEY=sk-proj-your-openai-api-key
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Supabase Access Token 및 Project Ref 설정:**

1. **SUPABASE_ACCESS_TOKEN** (Supabase CLI 인증용)
   - **역할**: GitHub Actions에서 Supabase CLI를 사용하여 프로젝트에 접근할 수 있도록 인증하는 토큰
   - **생성 방법**:
     1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인
     2. 우측 상단 프로필 아이콘 클릭 → **Account Settings**
     3. 왼쪽 메뉴에서 **Access Tokens** 선택
     4. **Generate new token** 클릭
     5. 토큰 이름 입력 (예: "GitHub Actions CI/CD")
     6. 생성된 토큰을 복사하여 GitHub Secrets에 `SUPABASE_ACCESS_TOKEN`으로 저장
   - ⚠️ **주의**: 토큰은 한 번만 표시되므로 안전하게 보관하세요

2. **SUPABASE_PROJECT_REF** (프로젝트 식별자)
   - **역할**: 여러 Supabase 프로젝트 중 어떤 프로젝트에 마이그레이션을 배포할지 식별하는 고유 ID
   - **확인 방법**:
     1. Supabase 대시보드에서 해당 프로젝트 선택
     2. 프로젝트 설정 > **API** 메뉴로 이동
     3. **Project URL**을 확인: `https://[project-ref].supabase.co`
     4. 여기서 `[project-ref]` 부분이 프로젝트 참조 ID입니다
     - 예: URL이 `https://abcdefghijklmnop.supabase.co`라면 `SUPABASE_PROJECT_REF=abcdefghijklmnop`
   - 또는 프로젝트 설정 > **General** 메뉴에서 **Reference ID** 확인 가능

#### Vercel 배포용 Secrets (선택사항)

```
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-org-id
VERCEL_PROJECT_ID=your-project-id
```

Vercel 토큰은 [Vercel Account Settings > Tokens](https://vercel.com/account/tokens)에서 생성할 수 있습니다.

## 배포 프로세스

### Frontend 배포 (Vercel)

#### 방법 1: GitHub Actions 자동 배포

1. GitHub Secrets 설정 완료
2. `main` 브랜치에 push하면 자동으로 배포됩니다

#### 방법 2: Vercel 대시보드에서 배포

1. [Vercel](https://vercel.com)에 로그인
2. "Add New Project" 클릭
3. GitHub 저장소 연결
4. 프로젝트 설정:
   - Framework Preset: Next.js
   - Root Directory: `frontend`
   - Build Command: `yarn build`
   - Output Directory: `.next`
5. Environment Variables 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Deploy 클릭

### Backend 스크립트 (GitHub Actions)

다음 워크플로우가 자동으로 실행됩니다:

- **뉴스 수집**: 시간대별 자동 실행
  - Peak Hours (5분 간격)
  - Active Hours (15분 간격)
  - Off Hours (30분 간격)
- **Multi-Agent 분석**: 매일 18:00 KST (장 마감 후)

수동 실행도 가능합니다:
- GitHub Actions 탭에서 워크플로우 선택
- "Run workflow" 버튼 클릭

## CI/CD 파이프라인

### Pull Request 시

다음 검증이 자동으로 실행됩니다:

1. **Lint & Type Check**: ESLint 및 TypeScript 타입 검사
2. **Build**: Frontend 빌드 테스트
3. **Script Validation**: Deno 스크립트 문법 검증
4. **Migration Check**: Supabase 마이그레이션 파일 검증

### Main 브랜치 Push 시

1. 모든 CI 검증 통과
2. Frontend 자동 배포 (Vercel)
3. 스케줄된 워크플로우 정상 실행

## 모니터링

### GitHub Actions

- Actions 탭에서 워크플로우 실행 상태 확인
- 실패한 워크플로우는 알림을 받을 수 있습니다

### Supabase

- Database > Logs에서 쿼리 로그 확인
- API > Logs에서 API 호출 로그 확인

### Vercel

- Dashboard에서 배포 상태 및 로그 확인
- Analytics에서 성능 메트릭 확인

## 트러블슈팅

### 마이그레이션 실패

```bash
# 로컬에서 마이그레이션 상태 확인
supabase db diff

# 특정 마이그레이션 롤백
supabase migration repair --status reverted <migration-name>
```

### 환경 변수 누락

GitHub Secrets에 모든 필수 환경 변수가 설정되어 있는지 확인하세요.

### 빌드 실패

```bash
# 로컬에서 빌드 테스트
cd frontend
yarn build
```

### Realtime 연결 실패

Supabase 대시보드에서 Realtime이 활성화되어 있는지 확인하세요.

