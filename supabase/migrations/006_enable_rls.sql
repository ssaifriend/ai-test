-- Enable Row Level Security on all public tables
-- This migration enables RLS but allows all operations for now
-- In production, you should implement proper RLS policies based on your auth requirements

-- Enable RLS on stocks table
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for service role
CREATE POLICY "Allow all for service role" ON public.stocks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow read for authenticated users
CREATE POLICY "Allow read for authenticated users" ON public.stocks
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow read for anon users (public data)
CREATE POLICY "Allow read for anon users" ON public.stocks
  FOR SELECT
  TO anon
  USING (true);

-- Enable RLS on news_sources table
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.news_sources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow read for authenticated users" ON public.news_sources
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read for anon users" ON public.news_sources
  FOR SELECT
  TO anon
  USING (true);

-- Enable RLS on news_articles table
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.news_articles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow read for authenticated users" ON public.news_articles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read for anon users" ON public.news_articles
  FOR SELECT
  TO anon
  USING (true);

-- Enable RLS on filtering_stats table
ALTER TABLE public.filtering_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.filtering_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow read for authenticated users" ON public.filtering_stats
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read for anon users" ON public.filtering_stats
  FOR SELECT
  TO anon
  USING (true);

-- Enable RLS on llm_usage_logs table
ALTER TABLE public.llm_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.llm_usage_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow read for authenticated users" ON public.llm_usage_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Note: llm_usage_logs is NOT readable by anon users (internal data)

-- Enable RLS on investment_opinions table
ALTER TABLE public.investment_opinions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.investment_opinions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow read for authenticated users" ON public.investment_opinions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read for anon users" ON public.investment_opinions
  FOR SELECT
  TO anon
  USING (true);
