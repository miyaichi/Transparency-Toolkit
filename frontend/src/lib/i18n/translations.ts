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
    filterPlaceholder: { en: "Filter sellers...", ja: "Filter sellers..." },
    confidential: { en: "Confidential", ja: "Confidential" },
    passthrough: { en: "Passthrough", ja: "Passthrough" },
    headers: {
      sellerId: { en: "Seller ID", ja: "Seller ID" },
      name: { en: "Name", ja: "Name" },
      type: { en: "Type", ja: "Type" },
      domain: { en: "Domain", ja: "Domain" },
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
  footer: {
    validationCodes: { en: "Validation Codes", ja: "検証コード一覧" }
  }
}
