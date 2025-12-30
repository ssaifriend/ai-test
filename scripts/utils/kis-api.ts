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

let cachedToken: KISToken | null = null;

/**
 * 한국투자증권 API 토큰 발급
 */
export async function getKISToken(
  appKey: string,
  appSecret: string
): Promise<string> {
  // 캐시된 토큰이 있고 만료되지 않았으면 재사용
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
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
          appkey: appKey,
          appsecret: appSecret,
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
    cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (23 * 60 * 60 * 1000),
    };

    return data.access_token;
  } catch (error) {
    logError("KIS API 토큰 발급 실패:", error);
    throw error;
  }
}

/**
 * 현재가 조회
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
  const token = await getKISToken(appKey, appSecret);

  try {
    const url = new URL("https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price");
    url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J"); // 주식
    url.searchParams.set("FID_INPUT_ISCD", stockCode);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "authorization": `Bearer ${token}`,
        "appkey": appKey,
        "appsecret": appSecret,
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
 * 일봉 차트 데이터 조회 (최근 100일)
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
  const token = await getKISToken(appKey, appSecret);

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
        "appkey": appKey,
        "appsecret": appSecret,
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
 * API 호출 간 딜레이 (Rate Limit 방지)
 * KIS API 제한: 초당 20건
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
