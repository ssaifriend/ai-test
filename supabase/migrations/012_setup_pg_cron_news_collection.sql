-- pg_cron을 사용한 뉴스 수집 자동화
-- Supabase Console에서 pg_cron extension을 먼저 활성화해야 합니다
-- 그리고 pg_net extension도 활성화해야 합니다 (HTTP 요청용)

-- pg_net extension 활성화
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 기존 크론 작업 제거 (있다면)
DO $$
BEGIN
  PERFORM cron.unschedule('news-collection-peak');
  PERFORM cron.unschedule('news-collection-active-morning');
  PERFORM cron.unschedule('news-collection-active-afternoon');
  PERFORM cron.unschedule('news-collection-off');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'cron jobs do not exist yet';
END $$;

-- Edge Function 호출 함수 (pg_net 사용)
CREATE OR REPLACE FUNCTION call_edge_function(function_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Supabase 설정 가져오기
  -- 실제 배포 시 Supabase Dashboard > Project Settings > API에서 값 확인 필요
  SELECT current_setting('app.settings.supabase_url', true) INTO supabase_url;
  SELECT current_setting('app.settings.service_role_key', true) INTO service_role_key;

  -- Edge Function 호출 (비동기)
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RETURN request_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to call % function: %', function_name, SQLERRM;
    RETURN NULL;
END;
$$;

-- 뉴스 수집 전체 파이프라인 실행 함수
CREATE OR REPLACE FUNCTION run_news_collection()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  collect_req_id bigint;
  filter_req_id bigint;
  content_req_id bigint;
BEGIN
  -- 1. 뉴스 수집
  SELECT call_edge_function('collect-news') INTO collect_req_id;
  RAISE NOTICE 'Collect news request ID: %', collect_req_id;

  -- 2. 뉴스 필터링
  SELECT call_edge_function('filter-news') INTO filter_req_id;
  RAISE NOTICE 'Filter news request ID: %', filter_req_id;

  -- 3. 원문 수집 (실패해도 계속 진행)
  BEGIN
    SELECT call_edge_function('collect-full-content') INTO content_req_id;
    RAISE NOTICE 'Collect content request ID: %', content_req_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Content collection failed (continuing): %', SQLERRM;
  END;

  RAISE NOTICE 'News collection pipeline triggered';
END;
$$;

-- 1. Peak Hours: 09:00-15:00 KST - Every 5 minutes
-- UTC로 변환: 00:00-06:00 (KST = UTC+9)
SELECT cron.schedule(
  'news-collection-peak',
  '*/5 0-5 * * 1-5', -- 월-금, UTC 00:00-05:55 (KST 09:00-14:55)
  'SELECT run_news_collection();'
);

-- 2. Active Hours Morning: 08:00-09:00 KST - Every 15 minutes
-- UTC: 23:00-00:00 (전날)
SELECT cron.schedule(
  'news-collection-active-morning',
  '0,15,30,45 23 * * 0-4', -- 일-목 23:00-23:45 (월-금 08:00-08:45 KST)
  'SELECT run_news_collection();'
);

-- 3. Active Hours Afternoon: 15:00-20:00 KST - Every 15 minutes
-- UTC: 06:00-11:00
SELECT cron.schedule(
  'news-collection-active-afternoon',
  '*/15 6-10 * * 1-5', -- 월-금 06:00-10:45 (KST 15:00-19:45)
  'SELECT run_news_collection();'
);

-- 4. Off Hours: 20:00-08:00 KST - Every 30 minutes
-- UTC: 11:00-23:00
SELECT cron.schedule(
  'news-collection-off',
  '*/30 11-22 * * *', -- 매일 11:00-22:30 (KST 20:00-07:30)
  'SELECT run_news_collection();'
);

-- 크론 작업 확인
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname LIKE 'news-collection%'
ORDER BY jobname;

-- 실행 히스토리 확인 (최근 10개)
COMMENT ON TABLE cron.job_run_details IS 'pg_cron 실행 히스토리 - SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;';
