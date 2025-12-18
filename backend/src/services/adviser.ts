
import { getGeminiModel } from "../lib/gemini";
import {
  getFieldDescription
} from "../lib/metadata-descriptions";


interface PublisherMetrics {
  name: string;
  domain: string;
  avg_ads_to_content_ratio: number;
  avg_page_weight: number;
  avg_ad_refresh: number;
  reseller_count: number;
  id_absorption_rate: number;
  avg_cpu: number;
  avg_ads_in_view: number;
}

export class AdviserService {
  /**
   * Generates an advisory report based on the target publisher data and benchmark data.
   */
  static async generateReport(
    target: PublisherMetrics,
    benchmark: PublisherMetrics,
    language?: string // Optional, defaults to "ja" internally if undefined/null or handled below
  ): Promise<string> {
    const model = getGeminiModel();

    // Ensure language is either 'en' or 'ja'
    const lang = (language === "en") ? "en" : "ja";
    const prompt = this.buildPrompt(target, benchmark, lang);

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Error generating advisory report:", error);
      throw new Error("Failed to generate report from Gemini.");
    }
  }

  private static buildPrompt(
    target: PublisherMetrics,
    benchmark: PublisherMetrics,
    language: string
  ): string {
    const definitions = this.getIndicatorDefinitions(language);

    if (language === "en") {
      return `
## Role Definition
You are an expert in programmatic advertising monetization and web performance optimization, acting as a supportive partner for publisher success.
Provide objective, data-driven advice while acknowledging the publisher's efforts and maintaining a warm, motivational tone.
Use professional insights to emphasize the positive potential of improvements.

## Input Context
The provided data includes the target site's metrics and **benchmark values from similar category sites**. Focus on relative evaluation.

### Target Publisher
- Name: ${target.name} (${target.domain})
- Stats:
  - Avg Ads to Content Ratio: ${(target.avg_ads_to_content_ratio * 100).toFixed(1)}%
  - Avg Page Weight: ${target.avg_page_weight.toFixed(2)} MB
  - Avg Ad Refresh: ${target.avg_ad_refresh.toFixed(1)} sec
  - Reseller Count: ${target.reseller_count}
  - ID Absorption Rate: ${(target.id_absorption_rate * 100).toFixed(1)}%
  - Avg CPU: ${target.avg_cpu.toFixed(1)}
  - Avg Ads in View: ${(target.avg_ads_in_view * 100).toFixed(1)}%

### Benchmark (Similar Publishers Average)
- Stats:
  - Avg Ads to Content Ratio: ${(benchmark.avg_ads_to_content_ratio * 100).toFixed(1)}%
  - Avg Page Weight: ${benchmark.avg_page_weight.toFixed(2)} MB
  - Avg Ad Refresh: ${benchmark.avg_ad_refresh.toFixed(1)} sec
  - Reseller Count: ${benchmark.reseller_count}
  - ID Absorption Rate: ${(benchmark.id_absorption_rate * 100).toFixed(1)}%
  - Avg CPU: ${benchmark.avg_cpu.toFixed(1)}
  - Avg Ads in View: ${(benchmark.avg_ads_in_view * 100).toFixed(1)}%

## Indicator Definitions
Analyze based on the following indicator definitions:
${definitions}

## Output Requirements
Output in English Markdown format with the following structure.

### 1. Executive Summary
- A catchphrase summarizing the site's status
- Estimated "Impression from Buyers" (e.g., Safe but low inventory quality, Technical debt present, Premium inventory, etc.)
- **Comparison with Similar Sites**: Briefly describe points of superiority/inferiority compared to the category average.

### 2. Priority Actions (Top 3)
- Three actions with the highest improvement effect read from the data.
- Cite specific numbers (e.g., "Current A2CR 40% is significantly higher than the similar site average of 25%").

### 3. Detailed Analysis
- **UX and Performance**: Impact on user experience (bounce rate, wall-clock time) based on page weight and CPU load.
- **Advertising Settings**: Consideration of how refresh settings and density might be affecting CPM and Fill Rate.
- **Supply Chain**: Proposals for profitability improvement by organizing intermediaries (SPO) and optimizing supply paths.

### 4. Summary
- A vision of the future expected if these improvements are executed.
`;
    }

    // Japanese Prompt
    return `
## Role Definition
あなたはプログラマティック広告の収益化とWebパフォーマンス最適化のエキスパートであり、パブリッシャーの成功を親身にサポートするパートナーです。
データに基づいた客観的な課題指摘を行いつつも、パブリッシャーの努力を認め、モチベーションを高めるような温かみのあるトーンでアドバイスを行ってください。
専門的な知見を用いながら、改善によってどれほど良くなり得るかというポジティブな側面を強調してください。

## Input Context
提供されるデータには、対象サイトの数値と、**類似したカテゴリのサイト平均値（Benchmark）**が含まれます。相対的な評価を重視してください。

### Target Publisher
- Name: ${target.name} (${target.domain})
- Stats:
  - Avg Ads to Content Ratio: ${(target.avg_ads_to_content_ratio * 100).toFixed(1)}%
  - Avg Page Weight: ${target.avg_page_weight.toFixed(2)} MB
  - Avg Ad Refresh: ${target.avg_ad_refresh.toFixed(1)} sec
  - Reseller Count: ${target.reseller_count}
  - ID Absorption Rate: ${(target.id_absorption_rate * 100).toFixed(1)}%
  - Avg CPU: ${target.avg_cpu.toFixed(1)}
  - Avg Ads in View: ${(target.avg_ads_in_view * 100).toFixed(1)}%

### Benchmark (Similar Publishers Average)
- Stats:
  - Avg Ads to Content Ratio: ${(benchmark.avg_ads_to_content_ratio * 100).toFixed(1)}%
  - Avg Page Weight: ${benchmark.avg_page_weight.toFixed(2)} MB
  - Avg Ad Refresh: ${benchmark.avg_ad_refresh.toFixed(1)} sec
  - Reseller Count: ${benchmark.reseller_count}
  - ID Absorption Rate: ${(benchmark.id_absorption_rate * 100).toFixed(1)}%
  - Avg CPU: ${benchmark.avg_cpu.toFixed(1)}
  - Avg Ads in View: ${(benchmark.avg_ads_in_view * 100).toFixed(1)}%

## Indicator Definitions
以下の指標定義に基づいて分析してください：
${definitions}

## Output Requirements
以下の構成で、日本語のMarkdown形式で出力してください。

### 1. 総合評価 (Executive Summary)
- サイトの状態を一言で表すキャッチフレーズ
- 推定される「バイヤーからの印象」（例：安全だが在庫品質が低い、技術的負債がある、プレミアムな在庫である等）
- **類似サイトとの比較**: カテゴリ平均と比較して、優れている点・劣っている点を簡潔に記述。

### 2. 重要課題トップ3 (Priority Actions)
- データから読み取れる最も改善効果が高い3つのアクション。
- 具体的な数値（例：「現在のA2CR 40%は、類似サイト平均の25%と比較しても著しく高いです」）を引用すること。

### 3. 詳細分析
- **UXとパフォーマンス**: ページ重量とCPU負荷に基づく、ユーザー体験（直帰率等）への影響。
- **広告設定**: リフレッシュ設定や密度が、CPMやFill Rateに与えているであろう影響の考察。
- **サプライチェーン**: 中間業者の整理（SPO）やads.txtの整理による収益性改善の提案。

### 4. まとめ
- この改善を実行した場合に期待できる将来像。
`;
  }

  private static getIndicatorDefinitions(language: string): string {
    const keyMapping: Record<string, string> = {
      avg_ads_to_content_ratio: "avgAdsToContentRatio",
      avg_page_weight: "avgPageWeight",
      avg_ad_refresh: "avgAdRefresh",
      reseller_count: "resellerCount",
      id_absorption_rate: "idAbsorptionRate",
      avg_cpu: "avgCpu",
      avg_ads_in_view: "avgAdsInView",
      total_unique_gpids: "totalUniqueGpids",
      total_supply_paths: "totalSupplyPaths",
    };

    const validLang = language === "en" ? "en" : "ja";

    return Object.entries(keyMapping)
      .map(([snakeKey, camelKey]) => {
        const description = getFieldDescription(camelKey, validLang);
        return `- ${snakeKey}: ${description}`;
      })
      .join("\n");
  }
}
