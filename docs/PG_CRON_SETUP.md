# Supabase pg_cron 설정 가이드

GitHub Actions 대신 Supabase의 pg_cron을 사용한 뉴스 수집 자동화 가이드입니다.

## 사전 준비

### 1. Supabase Extensions 활성화

Supabase Dashboard에 접속:
1. **Project Settings** → **Database**
2. **Extensions** 탭 클릭
3. 다음 Extension들을 활성화:
   - ✅ **pg_cron** - 스케줄링용
   - ✅ **pg_net** - HTTP 요청용 (Edge Function 호출)

### 2. Database Settings 설정

Supabase SQL Editor에서 실행:

```sql
-- Supabase URL 설정 (실제 URL로 변경)
ALTER DATABASE postgres SET app.settings.supabase_url TO 'https://YOUR_PROJECT.supabase.co';

-- Service Role Key 설정 (Project Settings > API에서 복사)
ALTER DATABASE postgres SET app.settings.service_role_key TO 'YOUR_SERVICE_ROLE_KEY';
```

**주의:** Service Role Key는 민감한 정보입니다. 절대 공개하지 마세요!

## 마이그레이션 실행

### 방법 1: Supabase CLI (권장)

```bash
# 마이그레이션 실행
supabase db push

# 또는 특정 마이그레이션만
supabase migration up 012_setup_pg_cron_news_collection
```

### 방법 2: Supabase Dashboard

1. **SQL Editor** 열기
2. `supabase/migrations/012_setup_pg_cron_news_collection.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기
4. **Run** 클릭

## 크론 작업 확인

### 등록된 크론 작업 확인

```sql
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname LIKE 'news-collection%'
ORDER BY jobname;
```

**기대 결과:**
```
 jobid |          jobname                  |    schedule      | active
-------+-----------------------------------+------------------+--------
   1   | news-collection-peak              | */5 0-5 * * 1-5  | true
   2   | news-collection-active-morning    | 0,15,30,45 23 * * 0-4 | true
   3   | news-collection-active-afternoon  | */15 6-10 * * 1-5| true
   4   | news-collection-off               | */30 11-22 * * * | true
```

### 실행 히스토리 확인

```sql
-- 최근 10개 실행 결과
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### 수동 실행 테스트

```sql
-- 뉴스 수집 파이프라인 수동 실행
SELECT run_news_collection();
```

## 스케줄 설명

| 시간대 | KST 시간 | 실행 주기 | Cron 표현식 |
|--------|----------|-----------|-------------|
| **Peak** | 09:00-15:00 (월-금) | 5분마다 | `*/5 0-5 * * 1-5` |
| **Active Morning** | 08:00-09:00 (월-금) | 15분마다 | `0,15,30,45 23 * * 0-4` |
| **Active Afternoon** | 15:00-20:00 (월-금) | 15분마다 | `*/15 6-10 * * 1-5` |
| **Off** | 20:00-08:00 (매일) | 30분마다 | `*/30 11-22 * * *` |

**참고:** Supabase는 UTC 시간을 사용합니다. KST = UTC + 9

## 크론 작업 관리

### 크론 작업 비활성화

```sql
-- 특정 작업 비활성화
SELECT cron.unschedule('news-collection-peak');

-- 또는 모든 뉴스 수집 작업 비활성화
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN
    SELECT jobname FROM cron.job WHERE jobname LIKE 'news-collection%'
  LOOP
    PERFORM cron.unschedule(job_record.jobname);
  END LOOP;
END $$;
```

### 스케줄 수정

```sql
-- 기존 작업 삭제 후 재생성
SELECT cron.unschedule('news-collection-peak');

SELECT cron.schedule(
  'news-collection-peak',
  '*/10 0-5 * * 1-5',  -- 5분 → 10분으로 변경
  'SELECT run_news_collection();'
);
```

## 모니터링

### 실패한 작업 확인

```sql
SELECT
  jobid,
  runid,
  status,
  return_message,
  start_time
FROM cron.job_run_details
WHERE status != 'succeeded'
ORDER BY start_time DESC
LIMIT 20;
```

### 오늘 실행된 작업 수

```sql
SELECT
  j.jobname,
  COUNT(*) as execution_count,
  COUNT(*) FILTER (WHERE jrd.status = 'succeeded') as success_count,
  COUNT(*) FILTER (WHERE jrd.status != 'succeeded') as failure_count
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE jrd.start_time >= CURRENT_DATE
  AND j.jobname LIKE 'news-collection%'
GROUP BY j.jobname;
```

## 트러블슈팅

### 문제: 크론 작업이 실행되지 않음

**확인 사항:**
1. pg_cron extension이 활성화되어 있는지 확인
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. 크론 작업이 active 상태인지 확인
   ```sql
   SELECT * FROM cron.job WHERE active = true;
   ```

### 문제: Edge Function 호출 실패

**확인 사항:**
1. pg_net extension이 활성화되어 있는지 확인
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

2. Supabase URL과 Service Role Key가 올바른지 확인
   ```sql
   SELECT current_setting('app.settings.supabase_url');
   SELECT current_setting('app.settings.service_role_key');
   ```

3. Edge Function이 배포되어 있는지 확인
   - Supabase Dashboard > Edge Functions

### 문제: 로그가 보이지 않음

pg_cron 로그는 PostgreSQL 로그에 기록됩니다:
- Supabase Dashboard > **Logs** > **Postgres Logs**

## GitHub Actions 제거 (선택)

pg_cron이 정상 작동하면 GitHub Actions를 제거할 수 있습니다:

1. `.github/workflows/news-collection.yml` 파일 삭제 또는
2. 스케줄러만 비활성화:
   ```yaml
   on:
     # schedule:  # 주석 처리
     #   - cron: "..."
     workflow_dispatch:  # 수동 트리거만 유지
   ```

## 장점

✅ **정확한 스케줄링** - GitHub Actions보다 훨씬 정확
✅ **안정성** - 높은 가용성과 신뢰성
✅ **무료** - Supabase 무료 티어에 포함
✅ **통합** - 데이터베이스와 같은 환경에서 실행
✅ **모니터링** - 실행 히스토리 자동 기록

## 참고 자료

- [Supabase pg_cron 문서](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [pg_net 문서](https://supabase.com/docs/guides/database/extensions/pg_net)
- [Cron 표현식 생성기](https://crontab.guru/)
