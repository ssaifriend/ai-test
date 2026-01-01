/**
 * 기술적 지표 계산 유틸리티
 *
 * 이동평균, RSI, MACD 등의 기술적 지표를 계산합니다.
 */

/**
 * 단순 이동평균 (Simple Moving Average) 계산
 */
export function calculateSMA(prices: number[], period: number): number | undefined {
  if (prices.length < period) {
    return undefined;
  }

  const recentPrices = prices.slice(0, period);
  const sum = recentPrices.reduce((acc, price) => acc + price, 0);
  return Math.round(sum / period);
}

/**
 * RSI (Relative Strength Index) 계산
 */
export function calculateRSI(prices: number[], period: number = 14): number | undefined {
  if (prices.length < period + 1) {
    return undefined;
  }

  // 가격 변화 계산
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i - 1] - prices[i]); // 최신이 앞에 있으므로 역순
  }

  // 최근 period개의 변화만 사용
  const recentChanges = changes.slice(0, period);

  // 상승분과 하락분 계산
  let gains = 0;
  let losses = 0;

  for (const change of recentChanges) {
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) {
    return 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return Math.round(rsi * 100) / 100;
}

/**
 * MACD (Moving Average Convergence Divergence) 계산
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: number;
  signal: number;
  histogram: number;
} | undefined {
  if (prices.length < slowPeriod) {
    return undefined;
  }

  // EMA 계산 헬퍼
  const calculateEMA = (data: number[], period: number): number[] => {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // 첫 번째 EMA는 SMA
    let sum = 0;
    for (let i = 0; i < period && i < data.length; i++) {
      sum += data[i];
    }
    ema[period - 1] = sum / period;

    // 이후 EMA 계산
    for (let i = period; i < data.length; i++) {
      ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }

    return ema;
  };

  // 최신 데이터가 앞에 있으므로 역순으로 정렬
  const reversedPrices = [...prices].reverse();

  // Fast EMA (12일)
  const fastEMA = calculateEMA(reversedPrices, fastPeriod);

  // Slow EMA (26일)
  const slowEMA = calculateEMA(reversedPrices, slowPeriod);

  if (!fastEMA[reversedPrices.length - 1] || !slowEMA[reversedPrices.length - 1]) {
    return undefined;
  }

  // MACD Line = Fast EMA - Slow EMA
  const macdLine: number[] = [];
  for (let i = slowPeriod - 1; i < reversedPrices.length; i++) {
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }

  // Signal Line = MACD의 9일 EMA
  const signalLine = calculateEMA(macdLine, signalPeriod);

  const latestMACD = macdLine[macdLine.length - 1];
  const latestSignal = signalLine[signalLine.length - 1];

  if (latestMACD === undefined || latestSignal === undefined) {
    return undefined;
  }

  return {
    macd: Math.round(latestMACD * 100) / 100,
    signal: Math.round(latestSignal * 100) / 100,
    histogram: Math.round((latestMACD - latestSignal) * 100) / 100,
  };
}

/**
 * 볼린저 밴드 (Bollinger Bands) 계산
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): {
  upper: number;
  middle: number;
  lower: number;
} | undefined {
  if (prices.length < period) {
    return undefined;
  }

  const recentPrices = prices.slice(0, period);

  // 중간선 (SMA)
  const middle = recentPrices.reduce((acc, price) => acc + price, 0) / period;

  // 표준편차 계산
  const variance = recentPrices.reduce((acc, price) => acc + Math.pow(price - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: Math.round((middle + stdDevMultiplier * stdDev) * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round((middle - stdDevMultiplier * stdDev) * 100) / 100,
  };
}
