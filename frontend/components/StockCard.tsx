"use client";

import Link from "next/link";
import type { Stock, InvestmentOpinion } from "../lib/types";

interface StockCardProps {
  stock: Stock;
  latestOpinion?: InvestmentOpinion;
}

export default function StockCard({ stock, latestOpinion }: StockCardProps) {
  const getRecommendationColor = (rec?: string) => {
    switch (rec) {
      case "buy":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "sell":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "hold":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getRecommendationText = (rec?: string) => {
    switch (rec) {
      case "buy":
        return "매수";
      case "sell":
        return "매도";
      case "hold":
        return "보유";
      default:
        return "분석 중";
    }
  };

  return (
    <Link href={`/stock/${stock.code}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{stock.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{stock.code}</p>
          </div>
          {latestOpinion && (
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${getRecommendationColor(
                latestOpinion.final_rec
              )}`}
            >
              {getRecommendationText(latestOpinion.final_rec)}
            </span>
          )}
        </div>

        {latestOpinion && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">신뢰도</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {latestOpinion.final_confidence}%
              </span>
            </div>
            {latestOpinion.target_price && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">목표가</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {latestOpinion.target_price.toLocaleString()}원
                </span>
              </div>
            )}
            {latestOpinion.timestamp && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(latestOpinion.timestamp).toLocaleString("ko-KR")}
              </div>
            )}
          </div>
        )}

        {!latestOpinion && (
          <div className="text-sm text-gray-500 dark:text-gray-400">분석 데이터 없음</div>
        )}
      </div>
    </Link>
  );
}

