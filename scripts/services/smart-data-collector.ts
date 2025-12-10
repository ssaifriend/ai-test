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

    // 재무 데이터 수집
    // 1. Supabase에 재무 데이터 테이블이 있다면 우선 조회
    // 2. 없으면 공개 API를 통해 수집 시도
    let financialData: FinancialData = {
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

    try {
      // Supabase에서 최근 재무 데이터 조회 시도
      // (향후 재무 데이터 테이블 추가 시 사용)
      // const { data: financialRecord } = await this.supabase
      //   .from("financial_data")
      //   .select("*")
      //   .eq("stock_code", stockCode)
      //   .order("updated_at", { ascending: false })
      //   .limit(1)
      //   .single();

      // 공개 API를 통한 재무 데이터 수집 시도
      // 한국투자증권 OpenAPI 또는 공개 데이터 소스 활용
      // 현재는 기본 구조만 제공하되, 실제 API 연동 시 확장 가능
      
      // 예시: 공개 API 호출 (실제 구현 시 API 키 필요)
      // const apiResponse = await fetch(`https://api.example.com/financial/${stockCode}`);
      // if (apiResponse.ok) {
      //   const data = await apiResponse.json();
      //   financialData = {
      //     per: data.per,
      //     pbr: data.pbr,
      //     roe: data.roe,
      //     debtRatio: data.debtRatio,
      //     currentRatio: data.currentRatio,
      //     revenue: data.revenue,
      //     operatingProfit: data.operatingProfit,
      //     netProfit: data.netProfit,
      //     cached: false,
      //   };
      // }

      // 현재는 기본값 반환 (실제 API 연동 전까지)
      // Agent는 undefined 값을 받아서 "데이터 없음"으로 처리
      console.log(`⚠️  재무 데이터 수집: ${stockCode} - API 연동 필요`);
    } catch (error) {
      console.error(`❌ 재무 데이터 수집 실패 (${stockCode}):`, error instanceof Error ? error.message : String(error));
      // 에러 발생 시에도 기본 구조 반환하여 Agent가 정상 동작하도록 함
    }

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

