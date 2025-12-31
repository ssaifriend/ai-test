-- pg_cron을 사용한 모든 스케줄러 자동화
--
-- 사전 준비:
-- 1. Supabase Vault에 secrets 저장 (SQL Editor에서 실행):
--    SELECT vault.create_secret('https://YOUR_PROJECT.supabase.co', 'supabase_url');
--    SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
--
--    (YOUR_PROJECT와 YOUR_SERVICE_ROLE_KEY를 실제 값으로 변경)
--    Service Role Key는 Project Settings > API에서 확인

-- Required extensions 활성화
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Extensions 확인
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension is not installed. Please enable it in Supabase Dashboard > Database > Extensions';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension is not installed. Please enable it in Supabase Dashboard > Database > Extensions';
  END IF;

  RAISE NOTICE 'All required extensions are installed: pg_cron, pg_net';
END $$;

-- 기존 크론 작업 제거 (있다면)
DO $$
DECLARE
  job_record RECORD;
BEGIN
  -- invoke-로 시작하는 모든 크론 작업 제거
  FOR job_record IN
    SELECT jobname FROM cron.job WHERE jobname LIKE 'invoke-%'
  LOOP
    PERFORM cron.unschedule(job_record.jobname);
    RAISE NOTICE 'Unscheduled job: %', job_record.jobname;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error unscheduling jobs: %', SQLERRM;
END $$;

-- ============================================================================
-- Peak Hours: 09:00-15:00 KST (00:00-06:00 UTC) - Every 5 minutes
-- ============================================================================

-- 1. 뉴스 수집 (Peak)
SELECT cron.schedule(
  'invoke-collect-news-peak',
  '*/5 0-5 * * 1-5', -- 월-금, UTC 00:00-05:55 (KST 09:00-14:55)
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/collect-news',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- 2. 뉴스 필터링 (Peak) - 수집 1분 후
SELECT cron.schedule(
  'invoke-filter-news-peak',
  '1-59/5 0-5 * * 1-5', -- 1, 6, 11, 16... 분에 실행
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/filter-news',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- 3. 원문 수집 (Peak) - 필터링 1분 후
SELECT cron.schedule(
  'invoke-full-content-peak',
  '2-59/5 0-5 * * 1-5', -- 2, 7, 12, 17... 분에 실행
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/collect-full-content',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Active Hours Morning: 08:00-09:00 KST (23:00-00:00 UTC prev day) - Every 15 min
-- ============================================================================

SELECT cron.schedule(
  'invoke-collect-news-active-morning',
  '0,15,30,45 23 * * 0-4', -- 일-목 23:00,15,30,45 (월-금 08:00,15,30,45 KST)
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/collect-news',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'invoke-filter-news-active-morning',
  '1,16,31,46 23 * * 0-4',
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/filter-news',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'invoke-full-content-active-morning',
  '2,17,32,47 23 * * 0-4',
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/collect-full-content',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Active Hours Afternoon: 15:00-20:00 KST (06:00-11:00 UTC) - Every 15 min
-- ============================================================================

SELECT cron.schedule(
  'invoke-collect-news-active-afternoon',
  '*/15 6-10 * * 1-5', -- 월-금 06:00,15,30,45 (KST 15:00,15,30,45)
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/collect-news',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'invoke-filter-news-active-afternoon',
  '1-59/15 6-10 * * 1-5',
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/filter-news',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'invoke-full-content-active-afternoon',
  '2-59/15 6-10 * * 1-5',
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/collect-full-content',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Off Hours: 20:00-08:00 KST (11:00-23:00 UTC) - Every 30 minutes
-- ============================================================================

SELECT cron.schedule(
  'invoke-collect-news-off',
  '*/30 11-22 * * *', -- 매일 11:00,30, 12:00,30... (KST 20:00,30, 21:00,30...)
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/collect-news',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'invoke-filter-news-off',
  '1-59/30 11-22 * * *',
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/filter-news',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'invoke-full-content-off',
  '2-59/30 11-22 * * *',
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/collect-full-content',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Financial Data Collection: 매일 14:00 KST (05:00 UTC)
-- ============================================================================

SELECT cron.schedule(
  'invoke-collect-financial-data',
  '0 5 * * *', -- 매일 05:00 UTC (14:00 KST)
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/collect-financial-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Multi-Agent Analysis: 장전/장중/장후 3회 실행
-- ============================================================================

-- 1. 장전: 08:30 KST (23:30 UTC 전날)
SELECT cron.schedule(
  'invoke-analyze-sentiment-premarket',
  '30 23 * * 0-4', -- 일-목 23:30 (월-금 08:30 KST)
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/analyze-sentiment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'invoke-multi-agent-premarket',
  '32 23 * * 0-4', -- 장전 감정분석 2분 후
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/multi-agent-analysis',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- 2. 장중: 12:00 KST (03:00 UTC)
SELECT cron.schedule(
  'invoke-analyze-sentiment-intraday',
  '0 3 * * 1-5', -- 월-금 03:00
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/analyze-sentiment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'invoke-multi-agent-intraday',
  '2 3 * * 1-5', -- 장중 감정분석 2분 후
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/multi-agent-analysis',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- 3. 장후: 15:40 KST (06:40 UTC)
SELECT cron.schedule(
  'invoke-analyze-sentiment-aftermarket',
  '40 6 * * 1-5', -- 월-금 06:40
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/analyze-sentiment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'invoke-multi-agent-aftermarket',
  '42 6 * * 1-5', -- 장후 감정분석 2분 후
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
             || '/functions/v1/multi-agent-analysis',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- 크론 작업 확인
-- ============================================================================

SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE 'invoke-%'
ORDER BY jobname;

-- 실행 히스토리 확인 쿼리 (직접 실행)
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
