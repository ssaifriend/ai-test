/**
 * 스마트 데이터 수집 서비스
 * 
 * Agent 분석에 필요한 데이터를 효율적으로 수집합니다.
 * 캐싱을 통해 API 호출 비용을 절감합니다.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadEnv } from "../utils/env.ts";
import { logError } from "../utils/error-handler.ts";
import { getCurrentPrice, getDailyChart } from "../utils/kis-api.ts";
import { calculateSMA, calculateRSI, calculateMACD } from "../utils/technical-indicators.ts";

export interface FinancialData {
  per?: number;
  pbr?: number;
  roe?: number;
  debtRatio?: number;
  currentRatio?: number;
  revenue?: number;
  operatingProfit?: number;
  netProfit?: number;
  cached: boolean;
  cachedAt?: string;
}

export interface TechnicalData {
  price: number;
  ma5?: number;
  ma20?: number;
  ma60?: number;
  rsi?: number;
  macd?: number;
  volume?: number;
  cached: boolean;
  cachedAt?: string;
}

export interface NewsData {
  recentNews: Array<{
    title: string;
    sentiment: "positive" | "negative" | "neutral";
    sentimentScore: number;
    impact: "high" | "medium" | "low";
    publishedAt: string;
  }>;
  sentimentTrend: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

export interface MacroData {
  kospi?: number;
  kosdaq?: number;
  usdKrw?: number;
  interestRate?: number;
  cached: boolean;
  cachedAt?: string;
}

export interface RiskData {
  volatility?: number;
  beta?: number;
  maxDrawdown?: number;
  riskLevel: "low" | "medium" | "high";
}

/**
 * 캐시 설정 (밀리초)
 */
const CACHE_TTL = {
  financial: 24 * 60 * 60 * 1000, // 24시간 (90% 캐싱)
  technical: 5 * 60 * 1000, // 5분 (50% 캐싱)
  macro: 7 * 24 * 60 * 60 * 1000, // 7일 (95% 캐싱)
} as const;

/**
 * 스마트 데이터 수집기
 */
export class SmartDataCollector {
  private supabase: ReturnType<typeof createClient<any, "public">>;
  private cache: Map<string, { data: unknown; expiresAt: number }> = new Map();
  private cacheUsage: Set<string> = new Set(); // 캐시 사용 추적

  constructor(supabase: ReturnType<typeof createClient<any, "public">>) {
    this.supabase = supabase;
  }

  /**
   * 캐시 사용 여부 확인
   */
  hasUsedCache(): boolean {
    return this.cacheUsage.size > 0;
  }

  /**
   * 캐시 사용 추적 초기화
   */
  resetCacheUsage(): void {
    this.cacheUsage.clear();
  }

  /**
   * 재무 데이터 수집 (캐싱 90%)
   * financial_data 테이블에서 우선 조회 (1시간 주기로 업데이트됨)
   */
  async collectFinancialData(stockCode: string): Promise<FinancialData> {
    const cacheKey = `financial:${stockCode}`;
    const cached = this.getFromCache<FinancialData>(cacheKey);

    if (cached) {
      this.cacheUsage.add(cacheKey);
      return { ...cached, cached: true, cachedAt: new Date().toISOString() };
    }

    // 1. financial_data 테이블에서 조회 (최우선)
    const { data: financialRecord } = await this.supabase
      .from("financial_data")
      .select("*")
      .eq("stock_code", stockCode)
      .single();

    if (financialRecord) {
      const financialData: FinancialData = {
        per: financialRecord.per,
        pbr: financialRecord.pbr,
        roe: financialRecord.roe,
        debtRatio: financialRecord.debt_ratio,
        currentRatio: financialRecord.current_ratio,
        revenue: financialRecord.revenue,
        operatingProfit: financialRecord.operating_profit,
        netProfit: financialRecord.net_profit,
        cached: false,
      };

      this.setCache(cacheKey, financialData, CACHE_TTL.financial);
      return financialData;
    }

    // 2. 테이블에 데이터가 없으면 기본값 반환
    // (별도 스크립트가 1시간마다 실행되어 데이터를 채울 것임)
    console.log(`ℹ️  재무 데이터 없음: ${stockCode} - collect-financial-data 스크립트 실행 필요`);

    const financialData: FinancialData = {
      per: undefined,
      pbr: undefined,
      roe: undefined,
      debtRatio: undefined,
      currentRatio: undefined,
      revenue: undefined,
      operatingProfit: undefined,
      netProfit: undefined,
      cached: false,
    };

    this.setCache(cacheKey, financialData, CACHE_TTL.financial);
    return financialData;
  }

  /**
   * 기술적 지표 수집 (캐싱 50%)
   */
  async collectTechnicalData(stockCode: string): Promise<TechnicalData> {
    const cacheKey = `technical:${stockCode}`;
    const cached = this.getFromCache<TechnicalData>(cacheKey);

    if (cached) {
      this.cacheUsage.add(cacheKey);
      return { ...cached, cached: true, cachedAt: new Date().toISOString() };
    }

    // 기본 데이터 구조
    let technicalData: TechnicalData = {
      price: 0,
      ma5: undefined,
      ma20: undefined,
      ma60: undefined,
      rsi: undefined,
      macd: undefined,
      volume: undefined,
      cached: false,
    };

    try {
      const { kisAppKey, kisAppSecret } = loadEnv();

      if (!kisAppKey || !kisAppSecret) {
        console.log(`ℹ️  기술적 지표 수집: ${stockCode} - KIS API 키 설정 필요 (한국투자증권 OpenAPI에서 발급)`);
        this.setCache(cacheKey, technicalData, CACHE_TTL.technical);
        return technicalData;
      }

      // 1. 현재가 조회
      const currentData = await getCurrentPrice(kisAppKey, kisAppSecret, stockCode);
      technicalData.price = currentData.price;
      technicalData.volume = currentData.volume;

      // 2. 일봉 데이터 조회 (최근 100일)
      const dailyChart = await getDailyChart(kisAppKey, kisAppSecret, stockCode, 100);

      if (dailyChart.length === 0) {
        console.log(`ℹ️  일봉 데이터 없음: ${stockCode}`);
        this.setCache(cacheKey, technicalData, CACHE_TTL.technical);
        return technicalData;
      }

      // 3. 종가 데이터 추출 (최신순)
      const closePrices = dailyChart.map((item) => item.close);

      // 4. 이동평균 계산
      technicalData.ma5 = calculateSMA(closePrices, 5);
      technicalData.ma20 = calculateSMA(closePrices, 20);
      technicalData.ma60 = calculateSMA(closePrices, 60);

      // 5. RSI 계산 (14일)
      technicalData.rsi = calculateRSI(closePrices, 14);

      // 6. MACD 계산 (12, 26, 9)
      const macdResult = calculateMACD(closePrices, 12, 26, 9);
      if (macdResult) {
        technicalData.macd = macdResult.macd;
      }

      console.log(`✅ 기술적 지표 수집 완료: ${stockCode} (가격: ${technicalData.price})`);
    } catch (error) {
      logError(`❌ 기술적 지표 수집 실패 (${stockCode}):`, error);
      // 에러 발생 시에도 기본 구조 반환하여 Agent가 정상 동작하도록 함
    }

    this.setCache(cacheKey, technicalData, CACHE_TTL.technical);
    return technicalData;
  }

  /**
   * 뉴스 데이터 수집 (캐싱 없음, 실시간)
   */
  async collectNewsData(stockId: string, limit: number = 20): Promise<NewsData> {
    const { data: news } = await this.supabase
      .from("news_articles")
      .select("title, sentiment, sentiment_score, impact, published_at")
      .eq("stock_id", stockId)
      .eq("analyzed", true)
      .not("sentiment", "is", null)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (!news || news.length === 0) {
      return {
        recentNews: [],
        sentimentTrend: { positive: 0, negative: 0, neutral: 0 },
      };
    }

    const sentimentTrend = {
      positive: news.filter((n) => n.sentiment === "positive").length,
      negative: news.filter((n) => n.sentiment === "negative").length,
      neutral: news.filter((n) => n.sentiment === "neutral").length,
    };

    return {
      recentNews: news.map((n) => ({
        title: n.title,
        sentiment: n.sentiment as "positive" | "negative" | "neutral",
        sentimentScore: n.sentiment_score || 0,
        impact: n.impact as "high" | "medium" | "low",
        publishedAt: n.published_at || new Date().toISOString(),
      })),
      sentimentTrend,
    };
  }

  /**
   * 거시경제 데이터 수집 (캐싱 95%)
   */
  async collectMacroData(): Promise<MacroData> {
    const cacheKey = "macro:global";
    const cached = this.getFromCache<MacroData>(cacheKey);

    if (cached) {
      this.cacheUsage.add(cacheKey);
      return { ...cached, cached: true, cachedAt: new Date().toISOString() };
    }

    // 실제로는 외부 API 호출 (예: 한국은행, 한국거래소 등)
    // 현재는 기본값 반환
    const macroData: MacroData = {
      kospi: undefined,
      kosdaq: undefined,
      usdKrw: undefined,
      interestRate: undefined,
      cached: false,
    };

    this.setCache(cacheKey, macroData, CACHE_TTL.macro);
    return macroData;
  }

  /**
   * 리스크 데이터 수집
   */
  async collectRiskData(stockCode: string): Promise<RiskData> {
    // 실제로는 과거 데이터 분석 또는 외부 API 호출
    // 현재는 기본값 반환
    return {
      volatility: undefined,
      beta: undefined,
      maxDrawdown: undefined,
      riskLevel: "medium",
    };
  }

  /**
   * 캐시에서 데이터 조회
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * 캐시에 데이터 저장
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cache.clear();
  }

}

