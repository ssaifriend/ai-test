"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { InvestmentOpinion } from "../lib/types";

export function useRealtimeOpinions(stockId: string) {
  const [opinions, setOpinions] = useState<InvestmentOpinion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 초기 데이터 로드
    const loadInitialData = async () => {
      const { data, error } = await supabase
        .from("investment_opinions")
        .select("*")
        .eq("stock_id", stockId)
        .order("timestamp", { ascending: false })
        .limit(30);

      if (!error && data) {
        setOpinions(data as InvestmentOpinion[]);
      }
      setLoading(false);
    };

    loadInitialData();

    // Realtime 구독 설정
    const channel = supabase
      .channel(`investment_opinions:${stockId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "investment_opinions",
          filter: `stock_id=eq.${stockId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newOpinion = payload.new as InvestmentOpinion;
            setOpinions((prev) => [newOpinion, ...prev].slice(0, 30));
          } else if (payload.eventType === "UPDATE") {
            const updatedOpinion = payload.new as InvestmentOpinion;
            setOpinions((prev) =>
              prev.map((op) => (op.id === updatedOpinion.id ? updatedOpinion : op))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setOpinions((prev) => prev.filter((op) => op.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stockId]);

  return { opinions, loading };
}

