// Define translations based on V1
// Ref: frontend/src/i18n/translations.ts

export type Language = "en" | "ja"

export const translations = {
  common: {
    validator: {
      en: "Validator",
      ja: "バリデータ"
    },
    dataExplorer: {
      en: "Data Explorer",
      ja: "データエクスプローラー"
    },
    dataExplorerDescription: {
      en: "Explore raw data from Ads.txt, App-ads.txt, and Sellers.json files without validation checks.",
      ja: "バリデーションチェックを行わずに、Ads.txt、App-ads.txt、Sellers.jsonファイルの生データを探索します。"
    },
    scanStatus: {
      en: "Scan Status",
      ja: "スキャン状況"
    },
    title: {
      en: "Ads.txt Validator",
      ja: "Ads.txt バリデータ"
    },
    description: {
      en: "Fetch, validate, display, and download Ads.txt and App-ads.txt files.",
      ja: "Ads.txtおよびApp-ads.txtファイルを取得、検証、表示、ダウンロードします。"
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
      ja: "ドメイン、IDでフィルタ..."
    },
    downloadCsv: {
      en: "Download CSV",
      ja: "CSVをダウンロード"
    },
    line: {
      en: "Line",
      ja: "行"
    },
    advertisingSystem: {
      en: "Advertising System",
      ja: "広告システム"
    },
    publisherAccountId: {
      en: "Publisher Account ID",
      ja: "パブリッシャーアカウントID"
    },
    relationship: {
      en: "Relationship",
      ja: "関係"
    },
    certId: {
      en: "Cert ID",
      ja: "認証ID"
    },
    status: {
      en: "Status",
      ja: "ステータス"
    },
    message: {
      en: "Message",
      ja: "メッセージ"
    },
    noRecords: {
      en: "No records found.",
      ja: "レコードが見つかりません。"
    },
    enterDomain: {
      en: "Enter a domain above and press Search to view report.",
      ja: "ドメインを入力して検索ボタンを押すとレポートが表示されます。"
    },
    loading: {
      en: "Fetching and analyzing...",
      ja: "取得・解析中..."
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
      title: { en: "No Sellers.json File", ja: "Sellers.jsonファイルがない" },
      description: {
        en: "No sellers.json file was found for the specified advertising system domain {{domain}}.",
        ja: "指定された広告システムドメイン{{domain}}のsellers.jsonファイルが見つかりませんでした。"
      }
    },
    directAccountIdNotInSellersJson: {
      title: { en: "DIRECT: Account ID Not in Sellers.json", ja: "DIRECT: アカウントIDがSellers.jsonにない" },
      description: {
        en: "Publisher account ID {{account_id}} not found in sellers.json for {{domain}}.",
        ja: "パブリッシャーアカウントID {{account_id}} が {{domain}} のsellers.jsonに見つかりません。"
      }
    },
    resellerAccountIdNotInSellersJson: {
      title: { en: "RESELLER: Account ID Not in Sellers.json", ja: "RESELLER: アカウントIDがSellers.jsonにない" },
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
  footer: {
    validationCodes: { en: "Validation Codes", ja: "検証コード一覧" }
  }
}
