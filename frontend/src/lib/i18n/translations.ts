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
        en: "The format of the Ads.txt entry is invalid and could not be parsed correctly.",
        ja: "Ads.txtエントリのフォーマットが無効で、正しく解析できませんでした。"
      }
    },
    missingFields: {
      title: { en: "Missing Required Fields", ja: "必須フィールドの欠落" },
      description: {
        en: "The ads.txt entry is missing the three required fields.",
        ja: "ads.txtエントリに必要な3つのフィールドがありません。"
      }
    },
    invalidRelationship: {
      title: { en: "Invalid Relationship", ja: "無効な関係タイプ" },
      description: {
        en: "The third required field must contain either DIRECT or RESELLER.",
        ja: "3番目の必須フィールドには「DIRECT」または「RESELLER」のいずれかが含まれている必要があります。"
      }
    },
    invalidDomain: {
      title: { en: "Invalid Domain", ja: "無効なドメイン" },
      description: {
        en: "The advertising system domain is not a valid domain.",
        ja: "広告システムドメインが有効なドメインではありません。"
      }
    },
    emptyAccountId: {
      title: { en: "Empty Account ID", ja: "空のアカウントID" },
      description: { en: "The account ID field is empty.", ja: "アカウントIDフィールドが空です。" }
    },
    // ... Additional keys can be added here as needed
    noSellersJson: {
      title: { en: "No Sellers.json File", ja: "sellers.jsonファイルがない" },
      description: {
        en: "No sellers.json file was found for the specified advertising system domain {{domain}}.",
        ja: "指定された広告システムドメイン{{domain}}のsellers.jsonファイルが見つかりませんでした。"
      }
    },
    directAccountIdNotInSellersJson: {
      title: { en: "DIRECT: Account ID Not in Sellers.json", ja: "DIRECT: アカウントIDがsellers.jsonにない" },
      description: {
        en: "Publisher account ID {{account_id}} not found in sellers.json for {{domain}}.",
        ja: "パブリッシャーアカウントID {{account_id}} が {{domain}} のsellers.jsonに見つかりません。"
      }
    },
    resellerAccountIdNotInSellersJson: {
      title: { en: "RESELLER: Account ID Not in Sellers.json", ja: "RESELLER: アカウントIDがsellers.jsonにない" },
      description: {
        en: "Reseller account ID {{account_id}} not found in sellers.json for {{domain}}.",
        ja: "リセラーアカウントID {{account_id}} が {{domain}} のsellers.jsonに見つかりません。"
      }
    },
    domainMismatch: {
      title: { en: "Domain Mismatch", ja: "ドメインの不一致" },
      description: {
        en: "The sellers.json domain ({{seller_domain}}) doesn't match the OWNERDOMAIN/MANAGERDOMAIN or publisher domain ({{publisher_domain}}).",
        ja: "sellers.jsonドメイン（{{seller_domain}}）がOWNERDOMAIN/MANAGERDOMAINまたはパブリッシャードメイン（{{publisher_domain}}）と一致しません。"
      }
    },
    directNotPublisher: {
      title: {
        en: "DIRECT: Seller Not Marked as PUBLISHER",
        ja: "DIRECT: セラーがPUBLISHERとしてマークされていません"
      },
      description: {
        en: "For a DIRECT relationship, the seller in sellers.json is listed as BOTH or INTERMEDIARY instead of PUBLISHER.",
        ja: "DIRECT関係の場合、sellers.jsonファイル内のセラーがPUBLISHERではなくBOTHまたはINTERMEDIARYとしてリストされています。"
      }
    },
    sellerIdNotUnique: {
      title: { en: "Seller ID Not Unique", ja: "セラーIDが一意ではありません" },
      description: {
        en: "Seller ID {{account_id}} appears multiple times in sellers.json for {{domain}}.",
        ja: "セラーID {{account_id}} が {{domain}} のsellers.jsonに複数回表示されています。"
      }
    },
    resellerNotIntermediary: {
      title: {
        en: "RESELLER: Seller Not Marked as INTERMEDIARY",
        ja: "RESELLER: セラーがINTERMEDIARYとしてマークされていません"
      },
      description: {
        en: "Seller {{account_id}} is not marked as INTERMEDIARY/BOTH in sellers.json (current type: {{seller_type}}).",
        ja: "セラー {{account_id}} がsellers.jsonでINTERMEDIARY/BOTHとしてマークされていません（現在のタイプ: {{seller_type}}）。"
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
    poweredBy: { en: "Powered by OpenSincera", ja: "Powered by OpenSincera" }
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
        commentOut: { en: "Comment out", ja: "コメントアウト" }
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
      download: { en: "Download {{fileType}}", ja: "{{fileType}} をダウンロード" }
    }
  },
  footer: {
    validationCodes: { en: "Validation Codes", ja: "検証コード一覧" }
  }
}
