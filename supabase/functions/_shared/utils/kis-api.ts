/**
 * 한국투자증권 Open API 유틸리티
 *
 * KIS Developers API를 사용하여 주가 데이터를 수집합니다.
 * API 신청: https://apiportal.koreainvestment.com
 */

import { logError } from "./error-handler.ts";

interface KISToken {
  accessToken: string;
  expiresAt: number;
}

/**
 * KIS API 클라이언트 클래스
 * 인스턴스 레벨에서 토큰을 캐싱하여 재사용합니다.
 */
export class KISApiClient {
  private appKey: string;
  private appSecret: string;
  private token: KISToken | null = null;

  constructor(appKey: string, appSecret: string) {
    this.appKey = appKey;
    this.appSecret = appSecret;
  }

  /**
   * 토큰 발급 또는 캐시된 토큰 반환
   */
  private async getToken(): Promise<string> {
    // 캐시된 토큰이 있고 만료되지 않았으면 재사용
    if (this.token && Date.now() < this.token.expiresAt) {
      return this.token.accessToken;
    }

    try {
      const response = await fetch(
        "https://openapi.koreainvestment.com:9443/oauth2/tokenP",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            grant_type: "client_credentials",
            appkey: this.appKey,
            appsecret: this.appSecret,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`토큰 발급 실패: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error("토큰이 응답에 없습니다.");
      }

      // 토큰 캐싱 (만료 시간: 24시간 - 안전 마진 1시간)
      this.token = {
        accessToken: data.access_token,
        expiresAt: Date.now() + (23 * 60 * 60 * 1000),
      };

      console.log(`✅ KIS API 토큰 발급 성공 (만료: ${new Date(this.token.expiresAt).toLocaleString()})`);

      return data.access_token;
    } catch (error) {
      logError("KIS API 토큰 발급 실패:", error);
      throw error;
    }
  }

  /**
   * 현재가 조회
   */
  async getCurrentPrice(
    stockCode: string
  ): Promise<{
    price: number;
    volume: number;
    changeRate: number;
  }> {
    const token = await this.getToken();

    try {
      const url = new URL("https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price");
      url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J"); // 주식
      url.searchParams.set("FID_INPUT_ISCD", stockCode);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "authorization": `Bearer ${token}`,
          "appkey": this.appKey,
          "appsecret": this.appSecret,
          "tr_id": "FHKST01010100", // 주식현재가 시세
        },
      });

      if (!response.ok) {
        throw new Error(`현재가 조회 실패: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.rt_cd !== "0") {
        throw new Error(`API 오류: ${data.msg1}`);
      }

      const output = data.output;

      return {
        price: parseInt(output.stck_prpr || "0", 10), // 현재가
        volume: parseInt(output.acml_vol || "0", 10), // 누적 거래량
        changeRate: parseFloat(output.prdy_ctrt || "0"), // 전일 대비율
      };
    } catch (error) {
      logError(`현재가 조회 실패 (${stockCode}):`, error);
      throw error;
    }
  }

  /**
   * 일봉 차트 데이터 조회
   */
  async getDailyChart(
    stockCode: string,
    days: number = 100
  ): Promise<Array<{
    date: string;
    close: number;
    volume: number;
  }>> {
    const token = await this.getToken();

    try {
      // 종료일 (오늘)
      const endDate = new Date();
      const endDateStr = endDate.toISOString().slice(0, 10).replace(/-/g, "");

      // 시작일 (100일 전)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().slice(0, 10).replace(/-/g, "");

      const url = new URL("https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-daily-price");
      url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
      url.searchParams.set("FID_INPUT_ISCD", stockCode);
      url.searchParams.set("FID_PERIOD_DIV_CODE", "D"); // 일봉
      url.searchParams.set("FID_ORG_ADJ_PRC", "0"); // 수정주가 미적용

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "authorization": `Bearer ${token}`,
          "appkey": this.appKey,
          "appsecret": this.appSecret,
          "tr_id": "FHKST01010400", // 주식일봉조회
        },
      });

      if (!response.ok) {
        throw new Error(`일봉 조회 실패: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.rt_cd !== "0") {
        throw new Error(`API 오류: ${data.msg1}`);
      }

      if (!data.output || !Array.isArray(data.output)) {
        return [];
      }

      return data.output.map((item: any) => ({
        date: item.stck_bsop_date, // 영업일자
        close: parseInt(item.stck_clpr || "0", 10), // 종가
        volume: parseInt(item.acml_vol || "0", 10), // 거래량
      }));
    } catch (error) {
      logError(`일봉 조회 실패 (${stockCode}):`, error);
      throw error;
    }
  }

  /**
   * 지수 현재가 조회 (KOSPI, KOSDAQ 등)
   */
  async getIndexPrice(
    indexCode: string
  ): Promise<{
    price: number;
    changeRate: number;
  }> {
    const token = await this.getToken();

    try {
      const url = new URL("https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-index-price");
      url.searchParams.set("FID_COND_MRKT_DIV_CODE", "U"); // 업종
      url.searchParams.set("FID_INPUT_ISCD", indexCode);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "authorization": `Bearer ${token}`,
          "appkey": this.appKey,
          "appsecret": this.appSecret,
          "tr_id": "FHPUP02100000", // 업종현재가 시세
        },
      });

      if (!response.ok) {
        throw new Error(`지수 조회 실패: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.rt_cd !== "0") {
        throw new Error(`API 오류: ${data.msg1}`);
      }

      const output = data.output;

      return {
        price: parseFloat(output.bstp_nmix_prpr || output.bstp_nmix_prdy_vrss || "0"), // 지수 현재가
        changeRate: parseFloat(output.bstp_nmix_prdy_ctrt || "0"), // 전일 대비율
      };
    } catch (error) {
      logError(`지수 조회 실패 (${indexCode}):`, error);
      throw error;
    }
  }
}

// ===== 하위 호환성을 위한 레거시 함수들 =====
// 기존 코드와의 호환성을 위해 유지하지만, KISApiClient 사용을 권장합니다.

let globalClient: KISApiClient | null = null;

function getGlobalClient(): KISApiClient {
  const appKey = Deno.env.get("KIS_APP_KEY");
  const appSecret = Deno.env.get("KIS_APP_SECRET");

  if (!appKey || !appSecret) {
    throw new Error("KIS_APP_KEY 또는 KIS_APP_SECRET 환경 변수가 설정되지 않았습니다.");
  }

  if (!globalClient) {
    globalClient = new KISApiClient(appKey, appSecret);
  }

  return globalClient;
}

/**
 * @deprecated KISApiClient 클래스 사용을 권장합니다.
 */
export async function getKISToken(
  appKey: string,
  appSecret: string
): Promise<string> {
  const client = new KISApiClient(appKey, appSecret);
  return (client as any).getToken();
}

/**
 * 현재가 조회
 * @deprecated KISApiClient 클래스 사용을 권장합니다.
 */
export async function getCurrentPrice(
  appKey: string,
  appSecret: string,
  stockCode: string
): Promise<{
  price: number;
  volume: number;
  changeRate: number;
}> {
  const client = getGlobalClient();
  return client.getCurrentPrice(stockCode);
}

/**
 * 일봉 차트 데이터 조회
 * @deprecated KISApiClient 클래스 사용을 권장합니다.
 */
export async function getDailyChart(
  appKey: string,
  appSecret: string,
  stockCode: string,
  days: number = 100
): Promise<Array<{
  date: string;
  close: number;
  volume: number;
}>> {
  const client = getGlobalClient();
  return client.getDailyChart(stockCode, days);
}

/**
 * 지수 현재가 조회 (KOSPI, KOSDAQ 등)
 * @deprecated KISApiClient 클래스 사용을 권장합니다.
 */
export async function getIndexPrice(
  appKey: string,
  appSecret: string,
  indexCode: string
): Promise<{
  price: number;
  changeRate: number;
}> {
  const client = getGlobalClient();
  return client.getIndexPrice(indexCode);
}

/**
 * API 호출 간 딜레이 (Rate Limit 방지)
 * KIS API 제한: 초당 20건
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
