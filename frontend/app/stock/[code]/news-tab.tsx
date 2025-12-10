"use client";

import NewsTimelineChart from "../../../components/NewsTimelineChart";
import type { NewsArticle } from "../../../lib/types";

interface NewsTabProps {
  news: NewsArticle[];
}

export default function NewsTab({ news }: NewsTabProps) {
  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return "border-l-green-500 bg-green-50 dark:bg-green-900/20";
      case "negative":
        return "border-l-red-500 bg-red-50 dark:bg-red-900/20";
      case "neutral":
        return "border-l-gray-500 bg-gray-50 dark:bg-gray-800";
      default:
        return "border-l-gray-300 bg-white dark:bg-gray-800";
    }
  };

  const getSentimentText = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return "긍정";
      case "negative":
        return "부정";
      case "neutral":
        return "중립";
      default:
        return "분석 중";
    }
  };

  const getImpactColor = (impact?: string) => {
    switch (impact) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "low":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  if (news.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">뉴스 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 뉴스 감성 트렌드 차트 */}
      <NewsTimelineChart news={news} />

      {/* 뉴스 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          최근 뉴스 ({news.length}개)
        </h3>
        <div className="space-y-4">
          {news.map((article) => (
            <div
              key={article.id}
              className={`border-l-4 rounded p-4 ${getSentimentColor(article.sentiment)}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white flex-1">
                  {article.title}
                </h4>
                <div className="flex gap-2 ml-4">
                  {article.sentiment && (
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getSentimentColor(
                        article.sentiment
                      )}`}
                    >
                      {getSentimentText(article.sentiment)}
                    </span>
                  )}
                  {article.impact && (
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getImpactColor(
                        article.impact
                      )}`}
                    >
                      {article.impact === "high" ? "높음" : article.impact === "medium" ? "보통" : "낮음"}
                    </span>
                  )}
                </div>
              </div>

              {article.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                  {article.description}
                </p>
              )}

              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <div className="flex gap-4">
                  {article.source && <span>출처: {article.source}</span>}
                  {article.published_at && (
                    <span>
                      {new Date(article.published_at).toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                {article.url && (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    원문 보기 →
                  </a>
                )}
              </div>

              {article.sentiment_score !== undefined && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>감성 점수</span>
                    <span>{article.sentiment_score.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full ${
                        article.sentiment_score > 0
                          ? "bg-green-500"
                          : article.sentiment_score < 0
                            ? "bg-red-500"
                            : "bg-gray-500"
                      }`}
                      style={{
                        width: `${Math.abs(article.sentiment_score) * 100}%`,
                        marginLeft: article.sentiment_score < 0 ? "auto" : "0",
                      }}
                    />
                  </div>
                </div>
              )}

              {article.key_topics && article.key_topics.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {article.key_topics.map((topic, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 text-xs rounded"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

