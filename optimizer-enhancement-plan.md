# Ads.txt Optimizer 機能拡張実装案

## 概要

現在のOptimizer機能（Step 1〜5）に、以下の2つの新機能を追加する：

1. **フォーマット正規化機能** - Step 1に統合
2. **認証局ID検証機能** - Step 6として新規追加

## 背景

### パブリッシャーの運用実態
- パブリッシャーは、ads.txt追加依頼があった際に、依頼元と依頼日をコメントで記載し、その後に依頼行を追加する運用を行っている
- この運用により、変更履歴と責任の所在を追跡可能にしている
- **結論**: 行のソート機能は実装しない（運用フローを壊すため）

### 必要性
- **フォーマット正規化**: 大文字小文字の不統一、改行コードの混在などがパースエラーや可読性の低下を引き起こす
- **認証局ID検証**: 誤った認証局IDは、広告システムの信頼性検証に影響を与える可能性がある

## 実装する機能

### 1. フォーマット正規化（Step 1への統合）

#### 機能詳細
Step 1「エラーと重複のクリーンアップ」に以下の正規化処理を追加：

| 処理項目 | 内容 | 優先度 |
|---------|------|-------|
| 大文字小文字の統一 | DIRECT/RESELLER → 大文字、ドメイン名 → 小文字 | 高 |
| 改行コードの統一 | CRLF/CR → LF | 高 |
| 余分な空行の削除 | 連続する空行を1行に、ファイル末尾の空行を削除 | 高 |
| スペースの正規化 | カンマ後のスペースを統一（`, ` の形式） | 中 |
| 行末スペースの削除 | trailing whitespace の除去 | 中 |

#### 実装の特徴
- 既存のコメント行は保持（依頼履歴の追跡のため）
- 行の順序は変更しない
- ユーザーが選択可能なオプションとして実装

### 2. 認証局ID検証（Step 6として新規追加）

#### 機能詳細
sellers.jsonデータベースを使用して、認証局ID（4番目のフィールド）を検証・修正：

| 処理 | 内容 |
|-----|------|
| 認証局IDの照合 | sellers_catalogテーブルから正しい認証局IDを取得 |
| 自動修正 | 誤っている場合は正しいIDに置き換え |
| 追加 | 欠落している場合は追加（sellers.jsonに存在する場合） |
| 統計情報 | 修正された行数をカウント |

#### 検証例

```
# 修正前
google.com, pub-1234567890, DIRECT, WRONG_ID

# sellers.jsonを確認
# → 正しい認証局ID: f08c47fec0942fa0

# 修正後
google.com, pub-1234567890, DIRECT, f08c47fec0942fa0
```

## 実装の詳細

### バックエンド実装

#### Step 1の拡張（フォーマット正規化）

**ファイル**: `backend/src/api/optimizer.ts`

```typescript
const optimizerSchema = z.object({
  content: z.string(),
  domain: z.string().optional(),
  ownerDomain: z.string().optional(),
  fileType: z.enum(['ads.txt', 'app-ads.txt']).default('ads.txt'),
  steps: z.object({
    removeErrors: z.boolean().default(false),
    invalidAction: z.enum(['remove', 'comment']).default('remove'),
    duplicateAction: z.enum(['remove', 'comment']).default('remove'),
    normalizeFormat: z.boolean().default(false), // NEW
    fixOwnerDomain: z.boolean().default(false),
    fixRelationship: z.boolean().default(false),
    fixManagerDomain: z.boolean().default(false),
    managerAction: z.enum(['remove', 'comment']).default('remove'),
    verifySellers: z.boolean().default(false),
    sellersAction: z.enum(['remove', 'comment']).default('remove'),
    verifyCertAuthority: z.boolean().default(false), // NEW (Step 6)
  }),
});
```

**処理フロー**:

```typescript
// Step 1: Clean Up (既存) + Format Normalization (新規)
if (steps.removeErrors) {
  // 既存のエラー・重複処理...

  if (steps.normalizeFormat) {
    const lines = optimizedContent.split(/\r?\n/);
    const normalizedLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // コメント行と空行はそのまま保持
      if (!trimmed || trimmed.startsWith('#')) {
        normalizedLines.push(line);
        continue;
      }

      // 変数ディレクティブ（OWNERDOMAIN等）の処理
      if (trimmed.toUpperCase().includes('OWNERDOMAIN=') ||
          trimmed.toUpperCase().includes('MANAGERDOMAIN=') ||
          trimmed.toUpperCase().includes('CONTACT=')) {
        // 大文字に統一
        const normalized = normalizeVariableLine(line);
        normalizedLines.push(normalized);
        continue;
      }

      // 通常のads.txtエントリの処理
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        // ドメイン名を小文字に
        parts[0] = parts[0].toLowerCase();

        // アカウントIDはそのまま

        // 関係性を大文字に（DIRECT/RESELLER）
        if (parts.length >= 3 && parts[2]) {
          const rel = parts[2].trim().toUpperCase();
          if (rel === 'DIRECT' || rel === 'RESELLER') {
            parts[2] = rel;
          }
        }

        // 認証局IDはそのまま（Step 6で処理）

        // カンマ区切りで再構成（カンマ後に1スペース）
        const normalized = parts.join(', ');
        normalizedLines.push(normalized);
      } else {
        normalizedLines.push(line);
      }
    }

    // 改行コードをLFに統一
    optimizedContent = normalizedLines.join('\n');

    // 連続する空行を1行に
    optimizedContent = optimizedContent.replace(/\n{3,}/g, '\n\n');

    // ファイル末尾の余分な空行を削除
    optimizedContent = optimizedContent.replace(/\n+$/, '\n');
  }
}
```

#### Step 6の実装（認証局ID検証）

```typescript
// Step 6: Certification Authority ID Verification
if (steps.verifyCertAuthority) {
  const lines = optimizedContent.split(/\r?\n/);
  const newLines: string[] = [];
  let certAuthorityFixed = 0;

  // ads.txtエントリを抽出
  const entriesToCheck: { domain: string; id: string; lineIndex: number }[] = [];
  const distinctDomains = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') ||
        line.toUpperCase().startsWith('OWNERDOMAIN=') ||
        line.toUpperCase().startsWith('MANAGERDOMAIN=') ||
        line.toUpperCase().startsWith('CONTACT=')) {
      continue;
    }

    const parts = line.split(',').map(s => s.trim());
    if (parts.length >= 2) {
      let domain = parts[0].toLowerCase();
      let id = parts[1];

      if (domain && id) {
        entriesToCheck.push({ domain, id, lineIndex: i });
        distinctDomains.add(domain);
      }
    }
  }

  if (entriesToCheck.length > 0) {
    const domainList = Array.from(distinctDomains);

    // sellers_catalogから認証局IDを取得
    const certAuthRes = await query(
      `SELECT DISTINCT domain,
              (raw_file_id IS NOT NULL) as has_file,
              -- sellers.jsonのメタデータから認証局IDを取得する必要がある
              -- 現在のスキーマでは認証局IDを保存していないため、
              -- raw_sellers_filesテーブルまたは新しいテーブルに保存が必要
              certification_authority_id
       FROM sellers_catalog
       WHERE domain = ANY($1::text[])
       GROUP BY domain`,
      [domainList]
    );

    // ドメインごとの認証局IDマップを作成
    const certAuthMap = new Map<string, string>();
    certAuthRes.rows.forEach((r: any) => {
      if (r.certification_authority_id) {
        certAuthMap.set(r.domain, r.certification_authority_id);
      }
    });

    // 各エントリの認証局IDを検証・修正
    newLines.push(...lines);

    for (const entry of entriesToCheck) {
      const correctCertAuth = certAuthMap.get(entry.domain);
      if (!correctCertAuth) continue;

      const line = newLines[entry.lineIndex];
      const parts = line.split(',').map(s => s.trim());

      // 認証局IDが存在する場合
      if (parts.length >= 4) {
        const currentCertAuth = parts[3].trim();
        if (currentCertAuth !== correctCertAuth) {
          parts[3] = correctCertAuth;
          newLines[entry.lineIndex] = parts.join(', ');
          certAuthorityFixed++;
        }
      } else if (parts.length === 3) {
        // 認証局IDが欠落している場合は追加
        parts.push(correctCertAuth);
        newLines[entry.lineIndex] = parts.join(', ');
        certAuthorityFixed++;
      }
    }

    optimizedContent = newLines.join('\n');
    modifiedCount += certAuthorityFixed;
  }
}
```

### データベース拡張

#### 認証局IDの保存

現在の `sellers_catalog` テーブルには認証局IDが保存されていないため、以下のいずれかの対応が必要：

**案1: sellers_catalogテーブルに列を追加**

```sql
ALTER TABLE sellers_catalog
ADD COLUMN certification_authority_id TEXT;

CREATE INDEX idx_sellers_catalog_cert_auth
ON sellers_catalog(domain, certification_authority_id);
```

**案2: 新しいテーブルを作成**

```sql
CREATE TABLE certification_authorities (
  domain TEXT PRIMARY KEY,
  certification_authority_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cert_auth_domain ON certification_authorities(domain);
```

**推奨**: 案1（sellers_catalogに追加）
- シンプルで既存の構造と整合性が取れる
- JOINが不要で高速

#### データ取得方法

sellers.jsonファイルには直接認証局IDは含まれていないため、以下の方法で取得：

1. **IAB Tech Labの公式リスト**: [https://iabtechlab.com/ads-txt/](https://iabtechlab.com/ads-txt/)
2. **各SSPの公開情報**: 主要SSPの認証局IDをマッピング
3. **既存のads.txtから学習**: よく使われる組み合わせを記録

主要SSPの認証局IDマッピング例：

```typescript
const KNOWN_CERT_AUTHORITIES: Record<string, string> = {
  'google.com': 'f08c47fec0942fa0',
  'rubiconproject.com': '0bfd66d529a55807',
  'openx.com': '6a698e2ec38604c6',
  'pubmatic.com': '5d62403b186f2ace',
  'appnexus.com': 'f5ab79cb980f11d1',
  'indexexchange.com': '50b1c356f2c5c8fc',
  'sovrn.com': 'fafdf38b16bf6b2b',
  'rhythmone.com': 'a670c89d4a324e47',
  'advertising.com': 'e1a5b5b6e3255540',
  'contextweb.com': '89ff185a4c4e857c',
  // 他のSSPも追加...
};
```

### フロントエンド実装

#### UIの変更

**ファイル**: `frontend/src/app/optimizer/page.tsx`

```typescript
const [steps, setSteps] = useState({
  removeErrors: true,
  invalidAction: "remove" as "remove" | "comment",
  duplicateAction: "remove" as "remove" | "comment",
  normalizeFormat: true, // NEW: デフォルトON
  fixOwnerDomain: false,
  fixRelationship: false,
  fixManagerDomain: false,
  managerAction: "remove" as "remove" | "comment",
  verifySellers: false,
  sellersAction: "remove" as "remove" | "comment",
  verifyCertAuthority: false, // NEW: Step 6
})
```

#### Step 1のUI拡張

```tsx
{/* Step 1 */}
<div className="flex items-start space-x-4 p-3 rounded-lg hover:bg-white transition-colors dark:hover:bg-slate-800">
  <Switch
    id="s1"
    checked={steps.removeErrors}
    onCheckedChange={(c) => setSteps((prev) => ({ ...prev, removeErrors: c }))}
    className="mt-1"
  />
  <div className="space-y-4 w-full">
    <div className="flex items-center justify-between">
      <Label htmlFor="s1" className="text-base font-medium cursor-pointer">
        {t("optimizerPage.steps.step1.title")}
      </Label>
      <Link
        href="/optimizer/guide#step1"
        target="_blank"
        className="text-muted-foreground hover:text-blue-600 transition-colors"
      >
        <HelpCircle className="h-4 w-4" />
      </Link>
    </div>
    <p className="text-sm text-muted-foreground">{t("optimizerPage.steps.step1.description")}</p>

    {steps.removeErrors && (
      <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
        {/* 既存の無効な行・重複の処理オプション */}

        {/* NEW: フォーマット正規化オプション */}
        <div className="space-y-2">
          <label className="flex items-center space-x-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={steps.normalizeFormat}
              onChange={(e) => setSteps((s) => ({ ...s, normalizeFormat: e.target.checked }))}
              className="accent-blue-600"
            />
            <span className="font-semibold">
              {t("optimizerPage.steps.step1.normalizeFormat")}
            </span>
          </label>
          <p className="text-xs text-muted-foreground ml-6">
            {t("optimizerPage.steps.step1.normalizeFormatDescription")}
          </p>
        </div>
      </div>
    )}
  </div>
</div>
```

#### Step 6のUI追加

```tsx
{/* Step 6: Certification Authority ID Verification */}
<div className="flex items-start space-x-4 p-3 rounded-lg hover:bg-white transition-colors dark:hover:bg-slate-800">
  <Switch
    id="s6"
    checked={steps.verifyCertAuthority}
    onCheckedChange={(c) => setSteps((prev) => ({ ...prev, verifyCertAuthority: c }))}
    className="mt-1"
  />
  <div className="space-y-4 w-full">
    <div className="flex items-center justify-between">
      <Label htmlFor="s6" className="text-base font-medium cursor-pointer">
        {t("optimizerPage.steps.step6.title")}
      </Label>
      <Link
        href="/optimizer/guide#step6"
        target="_blank"
        className="text-muted-foreground hover:text-blue-600 transition-colors"
      >
        <HelpCircle className="h-4 w-4" />
      </Link>
    </div>
    <p className="text-sm text-muted-foreground">{t("optimizerPage.steps.step6.description")}</p>
  </div>
</div>
```

### 国際化対応

#### 日本語（ja）

**ファイル**: `frontend/src/lib/i18n/translations/ja.ts`

```typescript
optimizerPage: {
  steps: {
    step1: {
      // 既存の翻訳...
      normalizeFormat: "フォーマットの正規化",
      normalizeFormatDescription: "大文字小文字の統一、改行コードの統一、余分な空行の削除を行います",
    },
    step6: {
      title: "認証局IDの検証",
      description: "sellers.jsonデータに基づいて、認証局ID（4番目のフィールド）を検証・修正します",
    },
  },
  results: {
    // 既存の翻訳...
    certAuthFixed: "{{count}}件の認証局IDを修正",
  },
}
```

#### 英語（en）

**ファイル**: `frontend/src/lib/i18n/translations/en.ts`

```typescript
optimizerPage: {
  steps: {
    step1: {
      // Existing translations...
      normalizeFormat: "Normalize Format",
      normalizeFormatDescription: "Standardize capitalization, line endings, and remove extra blank lines",
    },
    step6: {
      title: "Verify Certification Authority ID",
      description: "Validate and correct certification authority IDs (4th field) based on sellers.json data",
    },
  },
  results: {
    // Existing translations...
    certAuthFixed: "{{count}} certification authority IDs corrected",
  },
}
```

### 統計情報の拡張

**バックエンドのレスポンス**:

```typescript
return c.json({
  optimizedContent,
  stats: {
    originalLines,
    finalLines: optimizedContent.split(/\r?\n/).length,
    removedCount,
    commentedCount,
    modifiedCount,
    errorsFound,
    certAuthorityFixed, // NEW
  },
});
```

**フロントエンドの表示**:

```tsx
{stats.certAuthorityFixed !== undefined && stats.certAuthorityFixed > 0 && (
  <span className="flex items-center text-green-600 font-medium">
    <Check className="mr-1.5 h-4 w-4" />
    {t("optimizerPage.results.certAuthFixed", { count: stats.certAuthorityFixed.toString() })}
  </span>
)}
```

## ドキュメント更新

### optimizer.md の更新

**日本語版**: `frontend/public/help/ja/optimizer.md`

Step 1のセクションに追加：

```markdown
### フォーマット正規化（オプション）

ads.txtファイルのフォーマットを統一し、可読性とパース精度を向上させます。

#### 処理内容:
- **大文字小文字の統一**: DIRECT/RESELLERを大文字に、ドメイン名を小文字に統一
- **改行コードの統一**: CRLF/CRをLFに統一
- **余分な空行の削除**: 連続する空行を1行に、ファイル末尾の空行を削除
- **スペースの正規化**: カンマ後のスペースを統一（`, ` 形式）
- **行末スペースの削除**: trailing whitespace の除去

#### 重要:
- コメント行は保持されます（依頼履歴の追跡のため）
- 行の順序は変更されません
- 既存の運用フローに影響を与えません
```

新しいStep 6のセクションを追加：

```markdown
<a id="step6"></a>

## 6. 認証局IDの検証 (Verify Certification Authority ID)

ads.txtエントリの認証局ID（4番目のフィールド）が正しいかを検証し、誤っている場合は自動修正します。

### 機能:
このステップでは、既知の広告システムの認証局IDデータベースを使用して、ads.txtエントリの認証局IDを検証します。

#### **検証プロセス**:
1. ads.txt内の各エントリから広告システムのドメインを抽出
2. 既知の認証局IDデータベースで該当ドメインを検索
3. ads.txtの認証局ID（4番目のフィールド）と照合
4. **誤りがある場合**: 正しいIDに自動修正
5. **欠落している場合**: 認証局IDを追加

### 認証局IDとは:
認証局ID（Certification Authority ID）は、広告システムが認定を受けている認証機関のIDです。IAB Tech Labが管理する標準的な識別子で、各SSP/広告システムに固有の値が割り当てられています。

### 主要SSPの認証局ID例:
- **Google AdSense/AdX**: `f08c47fec0942fa0`
- **Rubicon Project**: `0bfd66d529a55807`
- **OpenX**: `6a698e2ec38604c6`
- **PubMatic**: `5d62403b186f2ace`
- **AppNexus**: `f5ab79cb980f11d1`

### 修正例:
```
# 修正前（誤り）
google.com, pub-1234567890, DIRECT, WRONG_ID

# 修正後（正）
google.com, pub-1234567890, DIRECT, f08c47fec0942fa0
```

### 重要性:
- **信頼性の向上**: 正しい認証局IDは、広告システムの信頼性検証に使用されます
- **透明性の確保**: 認証局IDにより、広告システムの正当性を確認できます
- **仕様準拠**: IAB Tech Labの仕様に準拠したads.txtファイルを維持できます

### 注意事項:
- このステップは、既知の広告システムの認証局IDデータベースに基づきます
- データベースに該当する認証局IDが存在しない場合、検証はスキップされます
- 新しい広告システムやマイナーなSSPの場合、認証局IDが不明な場合があります
```

## 実装の優先順位とスケジュール

### Phase 1: フォーマット正規化（Step 1拡張）

**優先度**: 高
**推定工数**: 2〜3日

1. バックエンド実装（1日）
   - `optimizer.ts`にフォーマット正規化ロジックを追加
   - テストケース作成
2. フロントエンド実装（1日）
   - UIにチェックボックス追加
   - 国際化対応
3. ドキュメント更新（0.5日）
4. テストと修正（0.5日）

### Phase 2: 認証局ID検証（Step 6追加）

**優先度**: 中
**推定工数**: 4〜5日

1. データベース拡張（1日）
   - sellers_catalogテーブルに列追加
   - マイグレーションスクリプト作成
   - 既知の認証局IDデータの投入
2. バックエンド実装（2日）
   - Step 6のロジック実装
   - データ取得・検証ロジック
   - テストケース作成
3. フロントエンド実装（1日）
   - Step 6のUI追加
   - 国際化対応
4. ドキュメント更新（0.5日）
5. テストと修正（0.5日）

## テストケース

### フォーマット正規化のテスト

```typescript
describe('Format Normalization', () => {
  it('should normalize case', () => {
    const input = 'Google.com, pub-123, direct, f08c47fec0942fa0';
    const expected = 'google.com, pub-123, DIRECT, f08c47fec0942fa0';
    // テスト実装...
  });

  it('should unify line endings', () => {
    const input = 'line1\r\nline2\rline3\n';
    const expected = 'line1\nline2\nline3\n';
    // テスト実装...
  });

  it('should remove extra blank lines', () => {
    const input = 'line1\n\n\nline2';
    const expected = 'line1\n\nline2';
    // テスト実装...
  });

  it('should preserve comment lines', () => {
    const input = '# Request from Agency A on 2025-01-15\ngoogle.com, pub-123, DIRECT';
    // コメント行が保持されることを確認
  });

  it('should not change line order', () => {
    const input = 'google.com, pub-1, DIRECT\nappnexus.com, pub-2, RESELLER';
    // 順序が変わらないことを確認
  });
});
```

### 認証局ID検証のテスト

```typescript
describe('Certification Authority ID Verification', () => {
  it('should fix incorrect cert authority ID', () => {
    const input = 'google.com, pub-123, DIRECT, WRONG_ID';
    const expected = 'google.com, pub-123, DIRECT, f08c47fec0942fa0';
    // テスト実装...
  });

  it('should add missing cert authority ID', () => {
    const input = 'google.com, pub-123, DIRECT';
    const expected = 'google.com, pub-123, DIRECT, f08c47fec0942fa0';
    // テスト実装...
  });

  it('should not modify correct cert authority ID', () => {
    const input = 'google.com, pub-123, DIRECT, f08c47fec0942fa0';
    // 変更されないことを確認
  });

  it('should skip unknown domains', () => {
    const input = 'unknown-ssp.com, pub-123, DIRECT';
    // データベースにない場合はスキップされることを確認
  });
});
```

## 注意事項とリスク

### フォーマット正規化

**リスク**:
- 意図的に特定のフォーマットを使用している場合（例: 全角文字でメモ）に影響が出る可能性
- **対策**: デフォルトONだが、ユーザーが無効化可能

**注意点**:
- コメント行の処理を慎重に行う（依頼履歴を壊さない）
- 行の順序を絶対に変更しない

### 認証局ID検証

**リスク**:
- データベースに存在しない新しいSSPの場合、検証がスキップされる
- **対策**: 既知の主要SSPから開始し、段階的に拡大

**注意点**:
- 認証局IDデータベースの継続的なメンテナンスが必要
- IAB Tech Labの公式リストと定期的に同期

## 将来的な拡張

### 認証局IDデータベースの自動更新
- IAB Tech LabのAPIまたはデータソースから定期的に更新
- 新しいSSPの自動検出と追加

### 機械学習による認証局ID推定
- 既存のads.txtデータから学習
- 不明なSSPの認証局IDを推定

### バリデーションレポートの生成
- 最適化前後の品質スコア表示
- 改善点の詳細レポート

## まとめ

この実装により、Ads.txt Managerのoptimizer機能は以下の点で強化されます：

1. **フォーマットの一貫性**: 大文字小文字、改行コード、スペースが統一され、可読性が向上
2. **認証局IDの正確性**: 誤った認証局IDが自動修正され、仕様準拠が強化される
3. **パブリッシャーの運用フローを尊重**: 行の順序やコメントを保持し、既存の運用を妨げない

段階的な実装により、リスクを最小化しながら価値を提供できます。
