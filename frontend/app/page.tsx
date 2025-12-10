import { supabase } from "../lib/supabase";
import StockCard from "../components/StockCard";
import FilteringStatsPanel from "../components/FilteringStatsPanel";
import type { Stock, InvestmentOpinion } from "../lib/types";
import type { FilteringStats } from "../components/FilteringStatsPanel";

async function getFilteringStats() {
  const { data: stats } = await supabase
    .from("filtering_stats")
    .select("*")
    .order("collected_at", { ascending: false })
    .limit(20);

  return stats || [];
}

async function getStocksWithLatestOpinions(): Promise<
  Array<{ stock: Stock; latestOpinion?: InvestmentOpinion }>
> {
  const { data: stocks, error: stocksError } = await supabase
    .from("stocks")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (stocksError || !stocks) {
    console.error("Failed to fetch stocks:", stocksError);
    return [];
  }

  // 각 종목의 최신 의견 조회
  const stocksWithOpinions = await Promise.all(
    (stocks as Stock[]).map(async (stock) => {
      const { data: opinion } = await supabase
        .from("investment_opinions")
        .select("*")
        .eq("stock_id", stock.id)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      return {
        stock: stock,
        latestOpinion: (opinion as InvestmentOpinion | null) || undefined,
      };
    })
  );

  return stocksWithOpinions;
}

export default async function Home() {
  const stocksWithOpinions = await getStocksWithLatestOpinions();
  const filteringStats = await getFilteringStats();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          관심 종목 대시보드
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Multi-Agent 시스템이 분석한 실시간 투자 의견을 확인하세요
        </p>
      </div>

      {stocksWithOpinions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">활성화된 종목이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {stocksWithOpinions.map(({ stock, latestOpinion }) => (
              <StockCard key={stock.id} stock={stock} latestOpinion={latestOpinion} />
            ))}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              필터링 통계
            </h2>
            <FilteringStatsPanel stats={filteringStats as FilteringStats[]} />
          </div>
        </>
      )}
    </div>
  );
}

