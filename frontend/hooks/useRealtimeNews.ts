"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { NewsArticle } from "../lib/types";

export function useRealtimeNews(stockId: string) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 초기 데이터 로드
    const loadInitialData = async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .eq("stock_id", stockId)
        .eq("analyzed", true)
        .order("published_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setNews(data as NewsArticle[]);
      }
      setLoading(false);
    };

    loadInitialData();

    // Realtime 구독 설정
    const channel = supabase
      .channel(`news_articles:${stockId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "news_articles",
          filter: `stock_id=eq.${stockId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newArticle = payload.new as NewsArticle;
            if (newArticle.analyzed) {
              setNews((prev) => [newArticle, ...prev].slice(0, 50));
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedArticle = payload.new as NewsArticle;
            if (updatedArticle.analyzed) {
              setNews((prev) =>
                prev.map((article) =>
                  article.id === updatedArticle.id ? updatedArticle : article
                )
              );
            }
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setNews((prev) => prev.filter((article) => article.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stockId]);

  return { news, loading };
}

