// Define translations based on V1
// Ref: frontend/src/i18n/translations.ts

export type Language = "en" | "ja"

export const translations = {
  common: {
    validator: {
      en: "Validator",
      ja: "バリデーター"
    },
    dataExplorer: {
      en: "Data Explorer",
      ja: "データエクスプローラー"
    },
    dataExplorerDescription: {
      en: "Explore raw data from Ads.txt, App-ads.txt, and Sellers.json files.",
      ja: "ads.txt、app-ads.txt、sellers.jsonファイルの生データを探索します。"
    },
    scanStatus: {
      en: "Scan Status",
      ja: "スキャン状況"
    },
    validatorDescription: {
      en: "Validate and download Ads.txt and App-ads.txt files.",
      ja: "ads.txtおよびapp-ads.txtファイルを検証、ダウンロードします。"
    },
    scanStatusDescription: {
      en: "Recent scan results for ads.txt, app-ads.txt, and sellers.json files.",
      ja: "ads.txt、app-ads.txt、およびsellers.jsonファイルの最近のスキャン結果です。"
    },
    analytics: {
      en: "Insite Analytics",
      ja: "インサイト分析"
    },
    optimizer: {
      en: "Optimizer",
      ja: "オプティマイザー"
    },
    analyticsDescription: {
      en: "Analyze publisher domain data using OpenSincera API.",
      ja: "OpenSincera APIを使用してパブリッシャードメインデータを分析します。"
    },
    title: {
      en: "Ads.txt Validator",
      ja: "Ads.txt バリデーター"
    },
    description: {
      en: "Validate and download Ads.txt and App-ads.txt files.",
      ja: "Ads.txtおよびApp-ads.txtファイルを検証、ダウンロードします。"
    },
    searchPlaceholder: {
      en: "e.g. nytimes.com",
      ja: "例: nytimes.com"
    },
    search: {
      en: "Search",
      ja: "検索"
    },
    totalRecords: {
      en: "Total Records",
      ja: "総レコード数"
    },
    validRecords: {
      en: "Valid Records",
      ja: "有効なレコード"
    },
    invalidRecords: {
      en: "Invalid Records",
      ja: "無効なレコード"
    },
    warnings: {
      en: "Warnings",
      ja: "警告"
    },
    filterPlaceholder: {
      en: "Filter by domain, ID...",
      ja: "Filter by domain, ID...."
    },
    downloadCsv: {
      en: "Download CSV",
      ja: "Download CSV"
    },
    line: {
      en: "Line",
      ja: "Line"
    },
    advertisingSystem: {
      en: "Advertising System",
      ja: "Advertising System"
    },
    publisherAccountId: {
      en: "Publisher Account ID",
      ja: "Publisher Account ID"
    },
    relationship: {
      en: "Relationship",
      ja: "Relationship"
    },
    certId: {
      en: "Cert ID",
      ja: "Cert ID"
    },
    status: {
      en: "Status",
      ja: "Status"
    },
    message: {
      en: "Message",
      ja: "Message"
    },
    noRecords: {
      en: "No records found.",
      ja: "レコードが見つかりません。"
    },
    enterDomain: {
      en: "Enter a domain above and press Search to view report.",
      ja: "ドメインを入力して検索ボタンを押すとレポートが表示されます。"
    },
    resultsFor: {
      en: "Results for",
      ja: "検索結果: "
    },
    clear: {
      en: "Clear",
      ja: "クリア"
    },
    type: {
      en: "Type",
      ja: "タイプ"
    },
    loading: {
      en: "Fetching and analyzing...",
      ja: "取得・解析中..."
    },
    failedToLoad: {
      en: "Failed to load report",
      ja: "レポートの読み込みに失敗しました"
    },
    sourceUrl: {
      en: "Source URL",
      ja: "ソースURL"
    },
    explore: {
      en: "Explore",
      ja: "探索"
    },
    explorerResultsFor: {
      en: "Explorer Results for",
      ja: "探索結果: "
    },
    sellerName: {
      en: "Seller Name",
      ja: "セラー名"
    },
    sellerType: {
      en: "Seller Type",
      ja: "セラータイプ"
    },
    isConfidential: {
      en: "Is Confidential",
      ja: "機密扱い"
    },
    sellerDomain: {
      en: "Seller Domain",
      ja: "セラードメイン"
    },
    auto: {
      en: "Auto",
      ja: "自動"
    },
    commentRaw: {
      en: "Comment / Raw",
      ja: "Comment / Raw"
    },
    ok: {
      en: "OK",
      ja: "OK"
    },
    error: {
      en: "Error",
      ja: "エラー"
    },
    yes: {
      en: "Yes",
      ja: "はい"
    },
    no: {
      en: "No",
      ja: "いいえ"
    },
    direct: {
      en: "DIRECT",
      ja: "DIRECT"
    },
    reseller: {
      en: "RESELLER",
      ja: "RESELLER"
    },
    records: {
      en: "records",
      ja: "レコード"
    },
    note: {
      en: "Note",
      ja: "注意"
    },
    backgroundFetchHint: {
      en: "Some sellers.json files indicate they are missing. We are fetching them in the background. Please wait a moment and try searching again for updated results.",
      ja: "一部のsellers.jsonファイルの取得が完了していない可能性があります。バックグラウンドで取得中ですので、数分待ってから再度検索すると結果が更新される場合があります。"
    }
  },
  validation: {
    // Ported from V1
    summary: {
      title: {
        en: "Validation Summary",
        ja: "検証サマリー"
      }
    }
  },
  explorerPage: {
    fetching: { en: "Fetching {{type}}...", ja: "{{type}}を取得中..." }
  },
  sellersPage: {
    metadata: { en: "Metadata", ja: "メタデータ" },
    stats: { en: "Stats", ja: "統計" },
    totalSellers: { en: "Total Sellers", ja: "Total Sellers" },
    publishers: { en: "Publishers", ja: "Publishers" },
    intermediaries: { en: "Intermediaries", ja: "Intermediaries" },
    both: { en: "Both", ja: "Both" },
    version: { en: "Version", ja: "バージョン" },
    contactEmail: { en: "Contact Email", ja: "連絡先メール" },
    contactAddress: { en: "Contact Address", ja: "連絡先住所" },
    filterPlaceholder: { en: "Filter sellers...", ja: "Filter sellers..." },
    confidential: { en: "Confidential", ja: "Confidential" },
    passthrough: { en: "Passthrough", ja: "Passthrough" },
    headers: {
      sellerId: { en: "Seller ID", ja: "Seller ID" },
      name: { en: "Name", ja: "Name" },
      type: { en: "Type", ja: "Type" },
      domain: { en: "Domain", ja: "Domain" },
      identifiers: { en: "Identifiers", ja: "識別子" },
      confidential: { en: "Confidential", ja: "Confidential" },
      passthrough: { en: "Passthrough", ja: "Passthrough" }
    },
    messages: {
      enterDomain: {
        en: "Enter a domain to fetch sellers.json.",
        ja: "ドメインを入力してsellers.jsonを取得してください。"
      },
      fetching: { en: "Fetching sellers.json from {{domain}}...", ja: "{{domain}}からsellers.jsonを取得中..." },
      failed: { en: "Failed to fetch sellers.json", ja: "sellers.jsonの取得に失敗しました" },
      noteTitle: { en: "Note", ja: "注意" },
      noteDescription: {
        en: "This feature fetches the live sellers.json from the domain. If the domain does not host a sellers.json file, this will fail.",
        ja: "この機能はドメインからライブsellers.jsonを取得します。sellers.jsonが存在しない場合は失敗します。"
      },
      noSellers: { en: "No sellers found matching filter.", ja: "条件に一致するセラーは見つかりませんでした。" }
    }
  },
  warnings: {
    // Ported from V1 keys
    invalidFormat: {
      title: { en: "Invalid Format", ja: "無効なフォーマット" },
      description: {
        en: "Invalid Format",
        ja: "無効なフォーマット"
      }
    },
    missingFields: {
      title: { en: "Missing Required Fields (Code: 11010)", ja: "必須フィールドの欠落（コード: 11010）" },
      description: {
        en: "Missing Required Fields (Code: 11010)",
        ja: "必須フィールドの欠落（コード: 11010）"
      }
    },
    invalidRelationship: {
      title: { en: "Invalid Relationship (Code: 11020)", ja: "無効な関係タイプ（コード: 11020）" },
      description: {
        en: "Invalid Relationship (Code: 11020)",
        ja: "無効な関係タイプ（コード: 11020）"
      }
    },
    invalidDomain: {
      title: { en: "Invalid Domain (Code: 11030)", ja: "無効なドメイン（コード: 11030）" },
      description: {
        en: "Invalid Domain (Code: 11030)",
        ja: "無効なドメイン（コード: 11030）"
      }
    },
    INVALID_DOMAIN: {
      title: { en: "Invalid Domain (Code: 11030)", ja: "無効なドメイン（コード: 11030）" },
      description: {
        en: "Invalid Domain (Code: 11030)",
        ja: "無効なドメイン（コード: 11030）"
      }
    },
    emptyAccountId: {
      title: { en: "Empty Account ID", ja: "空のアカウントID" },
      description: { en: "Empty Account ID", ja: "空のアカウントID" }
    },

    containsFullWidthChar: {
      title: { en: "Contains Full-width Characters", ja: "全角文字が含まれています" },
      description: {
        en: "The record contains full-width characters (e.g. １２３ usually used in CJK). Please replace with ASCII.",
        ja: "レコードに全角文字（例：１２３）が含まれています。半角英数字に修正してください。"
      }
    },
    invalidSeparator: {
      title: { en: "Invalid Separator", ja: "無効な区切り文字" },
      description: {
        en: "The record uses an invalid separator (e.g. tab, semicolon) instead of comma.",
        ja: "カンマの代わりに無効な区切り文字（タブ、セミコロンなど）が使用されています。"
      }
    },
    invalidCase: {
      title: { en: "Invalid Case in Relationship", ja: "関係性のタイプが大文字ではありません" },
      description: {
        en: "DIRECT or RESELLER should be uppercase.",
        ja: "DIRECT または RESELLER は大文字である必要があります。"
      }
    },
    // ... Additional keys can be added here as needed
    noSellersJson: {
      title: {
        en: "No Sellers.json File (Code: 12010, 13010)",
        ja: "Sellers.jsonファイルがない（コード: 12010, 13010）"
      },
      description: {
        en: "No Sellers.json File (Code: 12010, 13010)",
        ja: "Sellers.jsonファイルがない（コード: 12010, 13010）"
      }
    },
    directAccountIdNotInSellersJson: {
      title: {
        en: "DIRECT: Account ID Not in Sellers.json (Code: 12020)",
        ja: "DIRECT: アカウントIDがSellers.jsonにない（コード: 12020）"
      },
      description: {
        en: "DIRECT: Account ID Not in Sellers.json (Code: 12020)",
        ja: "DIRECT: アカウントIDがSellers.jsonにない（コード: 12020）"
      }
    },
    resellerAccountIdNotInSellersJson: {
      title: {
        en: "RESELLER: Account ID Not in Sellers.json (Code: 13020)",
        ja: "RESELLER: アカウントIDがSellers.jsonにない（コード: 13020）"
      },
      description: {
        en: "RESELLER: Account ID Not in Sellers.json (Code: 13020)",
        ja: "RESELLER: アカウントIDがSellers.jsonにない（コード: 13020）"
      }
    },
    domainMismatch: {
      title: { en: "Domain Mismatch (Code: 12030, 13030)", ja: "ドメインの不一致（コード: 12030, 13030）" },
      description: {
        en: "Domain Mismatch (Code: 12030, 13030)",
        ja: "ドメインの不一致（コード: 12030, 13030）"
      }
    },
    directNotPublisher: {
      title: {
        en: "DIRECT: Seller Not Marked as PUBLISHER (Code: 12040, 12050)",
        ja: "DIRECT: セラーがPUBLISHERとしてマークされていない（コード: 12040, 12050）"
      },
      description: {
        en: "DIRECT: Seller Not Marked as PUBLISHER (Code: 12040, 12050)",
        ja: "DIRECT: セラーがPUBLISHERとしてマークされていない（コード: 12040, 12050）"
      }
    },
    sellerIdNotUnique: {
      title: { en: "Seller ID Not Unique (Code: 12060, 13060)", ja: "セラーIDが一意ではない（コード: 12060, 13060）" },
      description: {
        en: "Seller ID Not Unique (Code: 12060, 13060)",
        ja: "セラーIDが一意ではない（コード: 12060, 13060）"
      }
    },
    resellerNotIntermediary: {
      title: {
        en: "RESELLER: Seller Not Marked as INTERMEDIARY (Code: 13040, 13050)",
        ja: "RESELLER: セラーがINTERMEDIARYとしてマークされていない（コード: 13040, 13050）"
      },
      description: {
        en: "RESELLER: Seller Not Marked as INTERMEDIARY (Code: 13040, 13050)",
        ja: "RESELLER: セラーがINTERMEDIARYとしてマークされていない（コード: 13040, 13050）"
      }
    }
  },
  warningsPage: {
    title: { en: "Validation Codes Reference", ja: "検証コードリファレンス" },
    description: {
      en: "Explanation of errors and warnings generated by the validator.",
      ja: "バリデータによって生成されるエラーと警告の解説です。"
    },
    code: { en: "Code", ja: "コード" },
    recommendation: { en: "Recommendation", ja: "推奨アクション" }
  },
  analyticsPage: {
    searchPlaceholder: {
      en: "Enter publisher domain (e.g. nytimes.com)",
      ja: "パブリッシャードメインを入力 (例: nytimes.com)"
    },
    analyze: { en: "Analyze", ja: "分析" },
    error: {
      domainNotFound: {
        en: "Domain not found in OpenSincera database.",
        ja: "OpenSinceraデータベースにドメインが見つかりません。"
      },
      generic: { en: "An error occurred while fetching data.", ja: "データの取得中にエラーが発生しました。" },
      checkDomain: { en: "Please check the domain name and try again.", ja: "ドメイン名を確認して再度お試しください。" }
    },
    supplyType: { en: "Supply Type", ja: "サプライタイプ" },
    unknown: { en: "Unknown", ja: "不明" },
    metrics: {
      directness: { en: "Directness", ja: "直接性" },
      idAbsorptionRate: { en: "ID Absorption Rate", ja: "ID吸収率" },
      adsToContent: { en: "Ads / Content", ja: "広告/コンテンツ比" },
      a2crRatio: { en: "A2CR Ratio", ja: "A2CR比率" },
      adRefresh: { en: "Ad Refresh", ja: "広告リフレッシュ" },
      avgTime: { en: "Avg. Time", ja: "平均時間" },
      inventory: { en: "Inventory", ja: "在庫" },
      uniqueGpids: { en: "Unique GPIDs", ja: "ユニークGPID" },
      adQuality: { en: "Ad Quality", ja: "広告品質" },
      avgAdsInView: { en: "Avg. Ads In View", ja: "平均インビュー率" },
      performance: { en: "Performance", ja: "パフォーマンス" },
      avgPageWeight: { en: "Avg. Page Weight", ja: "平均ページ重量" },
      complexity: { en: "Complexity", ja: "複雑性" },
      avgCpuUsage: { en: "Avg. CPU Usage", ja: "平均CPU使用率" },
      supplyChain: { en: "Supply Chain", ja: "サプライチェーン" },
      paths: { en: "Paths", ja: "パス" },
      resellers: { en: "Resellers", ja: "リセラー" }
    },
    updatedAt: { en: "Data updated:", ja: "データ更新日:" },
    poweredBy: { en: "Powered by OpenSincera", ja: "Powered by OpenSincera" },
    fields: {
      publisherId: { en: "Publisher ID", ja: "パブリッシャーID" },
      publisherName: { en: "Publisher Name", ja: "パブリッシャー名" },
      ownerDomain: { en: "Owner Domain", ja: "オーナー・ドメイン" },
      domain: { en: "Domain", ja: "ドメイン" },
      status: { en: "Status", ja: "ステータス" },
      verificationStatus: { en: "Verification Status", ja: "検証ステータス" },
      lastUpdated: { en: "Last Updated", ja: "最終更新日" },
      contactEmail: { en: "Contact Email", ja: "連絡先メールアドレス" },
      categories: { en: "Categories", ja: "カテゴリ" },
      parentEntityId: { en: "Parent Entity ID", ja: "親エンティティID" },
      similarPublishers: { en: "Similar Publishers", ja: "類似パブリッシャー" },
      description: { en: "Description", ja: "説明" },
      primarySupplyType: { en: "Primary Supply Type", ja: "主なサプライタイプ" },
      avgAdsToContentRatio: { en: "Avg Ads to Content Ratio", ja: "平均広告/コンテンツ比率" },
      avgAdsInView: { en: "Avg Ads in View", ja: "平均インビュー率" },
      avgAdRefresh: { en: "Avg Ad Refresh", ja: "平均広告リフレッシュ" },
      totalUniqueGpids: { en: "Total Unique GPIDs", ja: "総ユニークGPID数" },
      idAbsorptionRate: { en: "ID Absorption Rate", ja: "ID吸収率" },
      avgPageWeight: { en: "Avg Page Weight", ja: "平均ページ容量" },
      avgCpu: { en: "Avg CPU", ja: "平均CPU使用率" },
      totalSupplyPaths: { en: "Total Supply Paths", ja: "総サプライパス数" },
      resellerCount: { en: "Reseller Count", ja: "リセラー数" },
      slug: { en: "Slug", ja: "スラッグ" }
    }
  },
  scanStatusPage: {
    tabs: {
      adstxt: { en: "Ads.txt Scans", ja: "Ads.txtスキャン" },
      sellers: { en: "Sellers.json Scans", ja: "Sellers.jsonスキャン" }
    },
    adstxt: {
      title: { en: "Recent Ads.txt / App-ads.txt Scans", ja: "最新のads.txt / app-ads.txtスキャン" },
      description: {
        en: "List of recently fetched ads.txt and app-ads.txt files.",
        ja: "最近取得されたads.txt / app-ads.txtファイルの一覧です。"
      }
    },
    sellers: {
      title: { en: "Recent Sellers.json Scans", ja: "最新のsellers.jsonスキャン" },
      description: {
        en: "List of recently fetched sellers.json files.",
        ja: "最近取得されたsellers.jsonファイルの一覧です。"
      }
    },
    headers: {
      domain: { en: "Domain", ja: "ドメイン" },
      type: { en: "Type", ja: "タイプ" },
      scannedAt: { en: "Scanned At", ja: "スキャン日時" },
      fetchedAt: { en: "Fetched At", ja: "取得日時" },
      stats: { en: "Stats", ja: "統計" },
      status: { en: "Status", ja: "ステータス" },
      etag: { en: "ETag", ja: "ETag" }
    },
    messages: {
      loading: { en: "Loading...", ja: "読み込み中..." },
      failed: { en: "Failed to load data.", ja: "データの読み込みに失敗しました。" },
      noScans: { en: "No scans found yet.", ja: "スキャンデータはまだありません。" }
    }
  },
  optimizerPage: {
    title: { en: "Ads.txt Optimizer", ja: "Ads.txt オプティマイザー" },
    description: {
      en: "Optimize your ads.txt reliability by removing errors and verifying against sellers.json.",
      ja: "エラーを取り除き、sellers.jsonと照合することで、ads.txtの信頼性を最適化します。"
    },
    source: {
      title: { en: "Source", ja: "ソース" },
      domainLabel: { en: "Publisher Domain (Required)", ja: "パブリッシャードメイン (必須)" },
      fetchUrl: { en: "Fetch URL", ja: "URLから取得" },
      pasteText: { en: "Paste Text", ja: "テキストを貼り付け" },
      targetFile: { en: "Target File", ja: "対象ファイル" },
      fetch: { en: "Fetch", ja: "取得" },
      fetching: { en: "Fetching...", ja: "取得中..." },
      loadSample: { en: "Load Sample", ja: "サンプルを読み込む" },
      fetchDescription: {
        en: "We will fetch the live {{fileType}} file from the domain above.",
        ja: "上記のドメインからライブ{{fileType}}ファイルを取得します。"
      }
    },
    steps: {
      title: { en: "Optimization Steps", ja: "最適化ステップ" },
      step1: {
        title: { en: "1. Clean Up", ja: "1. クリーンアップ" },
        description: {
          en: "Handle format errors, duplicate lines, and invalid comments.",
          ja: "フォーマットエラー、重複行、無効なコメントを処理します。"
        },
        invalidRecords: { en: "Invalid Records", ja: "無効なレコード" },
        duplicates: { en: "Duplicates", ja: "重複" },
        remove: { en: "Remove", ja: "削除" },
        commentOut: { en: "Comment out", ja: "コメントアウト" },
        normalizeFormat: { en: "Normalize Format", ja: "フォーマットの正規化" },
        normalizeFormatDescription: {
          en: "Standardize capitalization, line endings, and remove extra blank lines.",
          ja: "大文字小文字の統一、改行コードの統一、余分な空行の削除を行います。"
        }
      },
      step2: {
        title: { en: "2. Owner Domain Verification", ja: "2. Owner Domain 検証" },
        description: {
          en: "Ensure OWNERDOMAIN matches the specified domain. If missing, it will be added.",
          ja: "OWNERDOMAINが指定されたドメインと一致することを確認します。見つからない場合は追加されます。"
        },
        label: { en: "Owner Domain", ja: "Owner Domain" },
        placeholder: {
          en: "Leave empty to use Publisher Domain ({{domain}}).",
          ja: "空欄の場合はパブリッシャードメイン ({{domain}}) を使用します。"
        }
      },
      step3: {
        title: { en: "3. Manager Domain Optimization", ja: "3. Manager Domain 最適化" },
        description: {
          en: "Resolve old or unnecessary MANAGERDOMAIN entries.",
          ja: "古くなった、または不要なMANAGERDOMAINエントリを解決します。"
        },
        action: { en: "Action", ja: "アクション" }
      },
      step4: {
        title: { en: "4. Relationship Correction", ja: "4. 関係性の修正" },
        description: {
          en: "Correct DIRECT/RESELLER relationship based on sellers.json data.",
          ja: "sellers.jsonデータに基づいてDIRECT/RESELLERの関係性を修正します。"
        }
      },
      step5: {
        title: { en: "5. Sellers.json Verification", ja: "5. Sellers.json 検証" },
        description: {
          en: "Remove entries that do not validate against upstream sellers.json files.",
          ja: "アップストリームのsellers.jsonファイルで検証できないエントリを削除します。"
        }
      },
      step6: {
        title: { en: "6. Cert. Authority ID Verification", ja: "6. 認証局IDの検証" },
        description: {
          en: "Validate and correct certification authority IDs (4th field) based on sellers.json data",
          ja: "sellers.jsonデータに基づいて、認証局ID（4番目のフィールド）を検証・修正します"
        }
      }
    },
    results: {
      title: { en: "Optimization Preview", ja: "最適化プレビュー" },
      before: { en: "Before", ja: "修正前" },
      after: { en: "After", ja: "修正後" },
      lines: { en: "lines", ja: "行" },
      linesRemoved: { en: "{{count}} lines removed", ja: "{{count}} 行削除されました" },
      formatErrors: { en: "{{count}} format errors", ja: "{{count}} フォーマットエラー" },
      noIssues: { en: "No issues found", ja: "問題は見つかりませんでした" },
      download: { en: "Download {{fileType}}", ja: "{{fileType}} をダウンロード" },
      certAuthFixed: { en: "{{count}} cert IDs corrected", ja: "{{count}}件の認証局IDを修正" }
    }
  },
  adviser: {
    title: { en: "Insite AI Adviser", ja: "Insite AI アドバイザー" },
    description: {
      en: "Diagnostics & improvement proposals based on data analysis",
      ja: "データ分析に基づく診断と改善提案"
    },
    button: {
      analyze: { en: "Run Diagnostic", ja: "診断を実行" },
      analyzing: { en: "Analyzing...", ja: "分析中..." },
      tryAgain: { en: "Try Again", ja: "再試行" },
      close: { en: "Close Report", ja: "レポートを閉じる" }
    },
    status: {
      fetchingBenchmarks: {
        en: "Fetching benchmark data from similar publishers...",
        ja: "類似パブリッシャーのベンチマークデータを取得中..."
      },
      generatingReport: {
        en: "Generating AI advisory report...",
        ja: "AIアドバイザリーレポートを生成中..."
      }
    },
    error: {
      failed: { en: "Failed to generate report", ja: "レポートの生成に失敗しました" },
      generic: { en: "Something went wrong", ja: "エラーが発生しました" }
    }
  },
  footer: {
    validationCodes: { en: "Validation Codes", ja: "検証コード一覧" }
  }
}
