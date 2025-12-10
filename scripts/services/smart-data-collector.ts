/**
 * 스마트 데이터 수집 서비스
 * 
 * Agent 분석에 필요한 데이터를 효율적으로 수집합니다.
 * 캐싱을 통해 API 호출 비용을 절감합니다.
 */

import { createClient } from "supabase";
import { loadEnv } from "../utils/env.ts";

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
  private supabase: ReturnType<typeof createClient>;
  private cache: Map<string, { data: unknown; expiresAt: number }> = new Map();
  private cacheUsage: Set<string> = new Set(); // 캐시 사용 추적

  constructor(supabase: ReturnType<typeof createClient>) {
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
   */
  async collectFinancialData(stockCode: string): Promise<FinancialData> {
    const cacheKey = `financial:${stockCode}`;
    const cached = this.getFromCache<FinancialData>(cacheKey);

    if (cached) {
      this.cacheUsage.add(cacheKey);
      return { ...cached, cached: true, cachedAt: new Date().toISOString() };
    }

    // Supabase에서 종목 기본 정보 조회
    const { data: stock } = await this.supabase
      .from("stocks")
      .select("*")
      .eq("code", stockCode)
      .single();

    if (!stock) {
      // 종목이 없으면 기본값 반환
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

    // 실제 재무 데이터는 외부 API (예: 한국거래소, DART 등)를 통해 수집
    // 현재는 기본 구조를 제공하되, 향후 API 연동 시 이 부분을 확장
    // 
    // 향후 구현 예정:
    // 1. DART API 연동: 재무제표 데이터 수집 (매출액, 영업이익, 순이익 등)
    // 2. 한국거래소 API 연동: 시가총액, PER, PBR 등 실시간 지표
    // 3. 외부 재무 데이터 서비스 연동: ROE, 부채비율, 유동비율 등
    
    // 현재는 Supabase에 저장된 기본 정보만 활용
    // 향후 재무 데이터 테이블 추가 시 여기서 조회
    const financialData: FinancialData = {
      per: undefined, // 향후 한국거래소 API에서 수집
      pbr: undefined, // 향후 한국거래소 API에서 수집
      roe: undefined, // 향후 DART API에서 수집
      debtRatio: undefined, // 향후 DART API에서 수집
      currentRatio: undefined, // 향후 DART API에서 수집
      revenue: undefined, // 향후 DART API에서 수집
      operatingProfit: undefined, // 향후 DART API에서 수집
      netProfit: undefined, // 향후 DART API에서 수집
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

    // 실제로는 외부 API 호출 (예: 한국투자증권 API 등)
    // 현재는 기본값 반환
    const technicalData: TechnicalData = {
      price: 0,
      ma5: undefined,
      ma20: undefined,
      ma60: undefined,
      rsi: undefined,
      macd: undefined,
      volume: undefined,
      cached: false,
    };

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

