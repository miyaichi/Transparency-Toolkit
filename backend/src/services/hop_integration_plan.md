# Hop Calculation Integration Plan

## 戦略: ハイブリッドアプローチ

### Phase 1: バックグラウンド計算（Scheduled Job）
**目的:** supply_chain_hops テーブルを事前に計算・更新

**実装:**
1. 新しいスケジュールジョブ: `scheduled/calculate_hops.ts`
2. 毎日 1 回実行（例: 深夜 3:00 AM JST）
3. 段階的処理:
   - Day 1: 最初の 1,000 ドメイン
   - Day 2: 次の 1,000 ドメイン
   - ...
   - 全ドメインを約 10 日でカバー（10,000 ドメインの場合）

**スケジュール例:**
\`\`\`typescript
// backend/src/scheduled/calculate_hops.ts
export async function runScheduledHopCalculation() {
  const calculator = new HopCalculatorServiceV3();
  
  // 1日あたり1,000ドメインを処理
  const BATCH_SIZE = 1000;
  
  // 前回処理した最後のドメインを取得
  const lastProcessedDomain = await getLastProcessedDomain();
  
  // 次のバッチを処理
  await calculator.calculateBatchHops(lastProcessedDomain, BATCH_SIZE);
  
  // 進捗を保存
  await saveProcessProgress();
}
\`\`\`

### Phase 2: バリデーター API での活用
**目的:** 既存の supply_chain_hops データを使ってホップ数を表示

**実装:**
1. `adstxt_service.ts` の `validateDomain()` を拡張
2. 各レコードについて supply_chain_hops を検索
3. hop_count が存在すれば使用、なければ推測ロジックにフォールバック

**コード例:**
\`\`\`typescript
// backend/src/services/adstxt_service.ts

async function enrichRecordsWithHopCount(
  publisherDomain: string,
  records: ValidationRecord[]
): Promise<ValidationRecord[]> {
  // Batch query for hop counts
  const sspAccountPairs = records
    .filter(r => r.domain && r.account_id)
    .map(r => ({ ssp: r.domain, accountId: r.account_id }));

  if (sspAccountPairs.length === 0) return records;

  const hopLookupSql = \`
    SELECT ssp_domain, account_id, hop_count, is_resolved, chain_path
    FROM supply_chain_hops
    WHERE publisher_domain = $1
      AND (ssp_domain, account_id) IN (...) 
  \`;

  const hopData = await query(hopLookupSql, [publisherDomain, ...]);
  
  // Map hop data to records
  const hopMap = new Map<string, any>();
  hopData.rows.forEach(row => {
    hopMap.set(\`\${row.ssp_domain}:\${row.account_id}\`, row);
  });

  // Enrich records
  return records.map(record => {
    const key = \`\${record.domain}:\${record.account_id}\`;
    const hopInfo = hopMap.get(key);

    if (hopInfo && hopInfo.is_resolved) {
      return {
        ...record,
        hop_count: hopInfo.hop_count,
        chain_path: hopInfo.chain_path,
      };
    }

    // Fallback to estimation logic
    return {
      ...record,
      hop_count: estimateHopCount(record), // Current logic
    };
  });
}
\`\`\`

### Phase 3: フロントエンドでの表示拡張
**目的:** 正確なホップ数と chain_path を可視化

**実装:**
1. ValidationRecord に hop_count, chain_path を追加
2. HopBadge コンポーネントを拡張:
   - 4, 5, 6+ の表示に対応
   - chain_path をツールチップで表示

**コード例:**
\`\`\`typescript
// frontend/src/components/explorer/explorer-result.tsx

function HopBadge({ record }: { record: ValidationRecord }) {
  const hop = record.hop_count ?? estimateHopCount(record);
  
  if (hop === null) return <span className="text-muted-foreground">-</span>;
  
  const badgeColor = hop === 1 ? 'emerald' : hop === 2 ? 'blue' : hop === 3 ? 'amber' : 'red';
  const display = hop >= 6 ? '6+' : hop;
  
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="outline" className={\`bg-\${badgeColor}-50 text-\${badgeColor}-700\`}>
          {display}
        </Badge>
      </TooltipTrigger>
      {record.chain_path && (
        <TooltipContent>
          Chain: {record.chain_path.join(' → ')}
        </TooltipContent>
      )}
    </Tooltip>
  );
}
\`\`\`

## 実装順序

### 🚀 Week 1: Foundation
- [x] HopCalculatorServiceV3 実装
- [x] test_hop_calculation.ts でテスト
- [ ] scheduled/calculate_hops.ts 実装
- [ ] Cloud Run での定期実行設定

### 📊 Week 2: API Integration  
- [ ] adstxt_service.ts に enrichRecordsWithHopCount 追加
- [ ] ValidationRecord に hop_count, chain_path フィールド追加
- [ ] API レスポンスのテスト

### 🎨 Week 3: Frontend Enhancement
- [ ] HopBadge コンポーネント拡張（4, 5, 6+ 対応）
- [ ] Chain path ツールチップ実装
- [ ] CSV エクスポートに hop_count 追加

### 📈 Week 4: Monitoring & Optimization
- [ ] ホップ計算の進捗ダッシュボード
- [ ] パフォーマンス最適化
- [ ] エラーハンドリング強化

## メトリクス

### 成功指標
- [ ] supply_chain_hops カバレッジ: 80%+ (monitored_domains)
- [ ] ホップ計算精度: 推測ロジックとの一致率 95%+
- [ ] API レスポンスタイム: 増加 < 100ms
- [ ] ホップ分布の可視化完了

### モニタリング
\`\`\`sql
-- Coverage check
SELECT 
  COUNT(DISTINCT md.domain) as total_domains,
  COUNT(DISTINCT sch.publisher_domain) as domains_with_hops,
  ROUND(100.0 * COUNT(DISTINCT sch.publisher_domain) / COUNT(DISTINCT md.domain), 2) as coverage_pct
FROM monitored_domains md
LEFT JOIN supply_chain_hops sch ON sch.publisher_domain = md.domain;

-- Hop distribution
SELECT hop_count, COUNT(*), ROUND(AVG(array_length(chain_path, 1)), 2) as avg_chain_length
FROM supply_chain_hops
WHERE is_resolved = true
GROUP BY hop_count
ORDER BY hop_count;
\`\`\`

## Next Steps (Immediate)

1. **ホップ計算テストの完了待ち** (進行中)
2. **scheduled/calculate_hops.ts 実装**
3. **小規模テスト実行**（100 ドメイン）
4. **結果検証後、本番投入**
