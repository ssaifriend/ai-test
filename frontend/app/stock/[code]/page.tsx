import { supabase } from "../../../lib/supabase";
import MultiAgentTab from "./multi-agent-tab";
import RealtimeTrackerTab from "./realtime-tracker-tab";
import type { Stock, InvestmentOpinion } from "../../../lib/types";

interface PageProps {
  params: Promise<{ code: string }>;
}

async function getStockData(code: string): Promise<{
  stock: Stock | null;
  latestOpinion: InvestmentOpinion | null;
  opinions: InvestmentOpinion[];
}> {
  // 종목 정보 조회
  const { data: stock, error: stockError } = await supabase
    .from("stocks")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .single();

  if (stockError || !stock) {
    return { stock: null, latestOpinion: null, opinions: [] };
  }

  // 최신 의견 조회
  const { data: latestOpinion } = await supabase
    .from("investment_opinions")
    .select("*")
    .eq("stock_id", stock.id)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  // 의견 히스토리 조회 (최근 30개)
  const { data: opinions } = await supabase
    .from("investment_opinions")
    .select("*")
    .eq("stock_id", stock.id)
    .order("timestamp", { ascending: false })
    .limit(30);

  return {
    stock: stock as Stock,
    latestOpinion: (latestOpinion as InvestmentOpinion) || null,
    opinions: (opinions as InvestmentOpinion[]) || [],
  };
}

export default async function StockPage({ params }: PageProps) {
  const { code } = await params;
  const { stock, latestOpinion, opinions } = await getStockData(code);

  if (!stock) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">종목을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 종목 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {stock.name} ({stock.code})
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {stock.market} • {stock.sector || "섹터 정보 없음"}
        </p>
      </div>

      {/* 탭 컨텐츠 */}
      {latestOpinion ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Multi-Agent 분석
            </h2>
            <MultiAgentTab opinion={latestOpinion} />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              실시간 추적
            </h2>
            <RealtimeTrackerTab opinions={opinions} />
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">아직 분석 데이터가 없습니다.</p>
        </div>
      )}
    </div>
  );
}

