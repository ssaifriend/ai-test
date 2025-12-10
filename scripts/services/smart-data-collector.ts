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
      // 방법 1: DART API를 통한 재무제표 데이터 수집
      const { dartApiKey } = loadEnv();
      if (dartApiKey) {
        const dartData = await this.fetchDARTFinancialData(stockCode, dartApiKey);
        if (dartData) {
          financialData = { ...financialData, ...dartData };
        }
      }

      // 방법 2: 네이버 금융에서 PER/PBR 등 시장 지표 수집
      const marketData = await this.fetchNaverFinanceData(stockCode);
      if (marketData) {
        financialData = { ...financialData, ...marketData };
      }

      // 방법 3: Supabase에 재무 데이터 테이블이 있다면 우선 조회
      // (향후 재무 데이터 테이블 추가 시 사용)
      // const { data: financialRecord } = await this.supabase
      //   .from("financial_data")
      //   .select("*")
      //   .eq("stock_code", stockCode)
      //   .order("updated_at", { ascending: false })
      //   .limit(1)
      //   .single();
      // if (financialRecord) {
      //   financialData = { ...financialData, ...financialRecord };
      // }

      if (financialData.per === undefined && financialData.pbr === undefined && !dartApiKey) {
        console.log(`ℹ️  재무 데이터 수집: ${stockCode} - DART API 키 설정 필요 (공공데이터포털에서 발급)`);
      }
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

  /**
   * DART API를 통한 재무제표 데이터 수집
   * 공공데이터포털(data.go.kr)에서 발급받은 API 키 필요
   */
  private async fetchDARTFinancialData(
    stockCode: string,
    apiKey: string
  ): Promise<Partial<FinancialData> | null> {
    try {
      // DART API: 종목코드로 기업 고유번호(corp_code) 조회
      const corpCodeUrl = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`;
      
      // 종목코드를 corp_code로 변환 (캐싱 필요)
      // 우선 종목코드를 직접 사용 시도 (일부 API는 종목코드 직접 지원)
      const currentYear = new Date().getFullYear();
      const reportCode = "11013"; // 1분기보고서 (연간: 11011)

      // DART API: 단일회사 전체 재무제표 조회
      // 주의: 종목코드가 아닌 corp_code가 필요하므로, 먼저 corp_code 조회 필요
      // 여기서는 간단히 종목코드로 시도 (실제로는 corp_code 변환 로직 필요)
      
      // 방법: 종목코드로 기업정보 조회 후 corp_code 획득
      const companyInfoUrl = `https://opendart.fss.or.kr/api/company.json?crtfc_key=${apiKey}&corp_code=${stockCode}`;
      const companyResponse = await fetch(companyInfoUrl);
      
      if (!companyResponse.ok) {
        // 종목코드가 corp_code가 아닌 경우, 다른 방법 시도
        return null;
      }

      const companyData = await companyResponse.json();
      if (companyData.status !== "000") {
        return null;
      }

      const corpCode = companyData.corp_code || stockCode;

      // 재무제표 조회
      const financialUrl = `https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${currentYear}&reprt_code=${reportCode}`;
      const response = await fetch(financialUrl);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.status !== "000" || !data.list || data.list.length === 0) {
        return null;
      }

      // 재무제표 데이터 파싱
      const financials: Partial<FinancialData> = {};
      
      for (const item of data.list) {
        const accountNm = item.account_nm;
        const thstrmAmount = parseFloat(item.thstrm_amount?.replace(/,/g, "") || "0");

        // 재무 지표 추출
        if (accountNm.includes("당기순이익") || accountNm.includes("당기순손익")) {
          if (!financials.netProfit || Math.abs(thstrmAmount) > Math.abs(financials.netProfit || 0)) {
            financials.netProfit = thstrmAmount;
          }
        }
        if (accountNm.includes("영업이익")) {
          if (!financials.operatingProfit || Math.abs(thstrmAmount) > Math.abs(financials.operatingProfit || 0)) {
            financials.operatingProfit = thstrmAmount;
          }
        }
        if (accountNm.includes("매출액") || accountNm.includes("매출")) {
          if (!financials.revenue || Math.abs(thstrmAmount) > Math.abs(financials.revenue || 0)) {
            financials.revenue = thstrmAmount;
          }
        }
      }

      return Object.keys(financials).length > 0 ? financials : null;
    } catch (error) {
      console.error(`DART API 호출 실패 (${stockCode}):`, error);
      return null;
    }
  }

  /**
   * 네이버 금융에서 PER/PBR 등 시장 지표 수집
   * 웹 스크래핑 또는 공개 API 활용
   */
  private async fetchNaverFinanceData(
    stockCode: string
  ): Promise<Partial<FinancialData> | null> {
    try {
      // 네이버 금융 종목 페이지 URL
      const url = `https://finance.naver.com/item/main.naver?code=${stockCode}`;
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      
      // HTML에서 PER, PBR 추출 (간단한 정규식 사용)
      // 실제로는 더 정교한 파싱 필요
      const perMatch = html.match(/PER[^<]*?(\d+\.?\d*)/i);
      const pbrMatch = html.match(/PBR[^<]*?(\d+\.?\d*)/i);

      const marketData: Partial<FinancialData> = {};

      if (perMatch && perMatch[1]) {
        marketData.per = parseFloat(perMatch[1]);
      }
      if (pbrMatch && pbrMatch[1]) {
        marketData.pbr = parseFloat(pbrMatch[1]);
      }

      return Object.keys(marketData).length > 0 ? marketData : null;
    } catch (error) {
      console.error(`네이버 금융 데이터 수집 실패 (${stockCode}):`, error);
      return null;
    }
  }
}

