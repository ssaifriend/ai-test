// 이 파일은 Supabase CLI로 자동 생성됩니다
// 임시 타입 정의
export type Database = {
  public: {
    Tables: {
      stocks: {
        Row: {
          id: string;
          code: string;
          name: string;
          market: string;
          sector: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["stocks"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["stocks"]["Insert"]>;
      };
      news_articles: {
        Row: {
          id: string;
          stock_id: string;
          title: string;
          description: string | null;
          source: string | null;
          url: string | null;
          published_at: string | null;
          collected_at: string;
          full_content_summary: string | null;
          financial_numbers: string[] | null;
          key_facts: string[] | null;
          future_outlook: string | null;
          importance: string | null;
          has_full_content: boolean;
          filter_score: number | null;
          sentiment: string | null;
          sentiment_score: number | null;
          key_topics: string[] | null;
          impact: string | null;
          analyzed: boolean;
          analysis_version: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["news_articles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["news_articles"]["Insert"]>;
      };
    };
  };
};

