# GitHub Actions 워크플로우

## 제거된 워크플로우

다음 스케줄된 워크플로우들은 Supabase pg_cron으로 이전되었습니다:

- ~~`news-collection.yml`~~ → `supabase/migrations/012_setup_pg_cron_schedulers.sql`
- ~~`collect-financial-data.yml`~~ → `supabase/migrations/012_setup_pg_cron_schedulers.sql`
- ~~`multi-agent-analysis.yml`~~ → `supabase/migrations/012_setup_pg_cron_schedulers.sql`

**이유:** GitHub Actions의 cron 스케줄러는 부하가 높을 때 지연되거나 건너뛰어질 수 있습니다.
Supabase pg_cron을 사용하면 훨씬 정확하고 안정적인 스케줄링이 가능합니다.

## 남아있는 워크플로우

### 배포 관련 (수동 트리거)

- **`deploy-frontend.yml`** - 프론트엔드 배포
- **`deploy-supabase.yml`** - Supabase Edge Functions 배포
- **`supabase-migration.yml`** - 데이터베이스 마이그레이션 실행

이들은 `workflow_dispatch`로 수동 실행만 가능하며, 스케줄링이 필요 없습니다.

## pg_cron 스케줄 확인

Supabase SQL Editor에서 실행:

```sql
-- 등록된 크론 작업 확인
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE 'invoke-%'
ORDER BY jobname;

-- 실행 히스토리 확인
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

## 수동 트리거 방법

필요 시 Supabase Edge Function을 직접 호출할 수 있습니다:

```bash
# 뉴스 수집
curl -X POST "$SUPABASE_URL/functions/v1/collect-news" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

# 거시경제 데이터 수집
curl -X POST "$SUPABASE_URL/functions/v1/collect-financial-data" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

# 멀티 에이전트 분석
curl -X POST "$SUPABASE_URL/functions/v1/multi-agent-analysis" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## 참고 문서

- **pg_cron 설정 가이드**: `docs/PG_CRON_SETUP.md`
- **스케줄러 대안**: `docs/CRON_ALTERNATIVES.md`
