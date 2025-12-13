# Search機能

以下のデータセットを切り替えて検索できます。
- ads.txt
- app-ads.txt
- sellers.json

主な機能
- ドメインベース検索：指定したドメインに対し、ads.txt / app-ads.txt / sellers.json の情報を網羅的に表示。ページングに対応。
- Filter：表示項目に対するインクリメンタルサーチ。部分一致検索に対応。
- ダウンロード：ドメインが指定された状態で、ads.txt / app-ads.txt / sellers.json の内容を Excel で開ける形式でダウンロード可能。

## ads.txt 表示項目一覧
ads.txt モードでは、**パブリッシャー視点（ドメイン起点）**での正当性確認に必要な情報が並びます。

| 表示項目 | 内容 | 実務的な意味 |
| --- | --- | --- |
| Domain Name | 対象パブリッシャードメイン | ads.txt を配置している媒体 |
| Advertising System Name | SSP / Exchange のドメイン | どの販売者経由か |
| Publisher Account ID | パブリッシャーアカウント ID | SSP 側の publisher_id |
| Relationship | DIRECT / RESELLER | 直接販売か再販か |
| Certification Authority ID (CA ID) | 認証局 ID | OpenRTB / Ads.txt 認証用 |
| Owner Domain | OWNERDOMAIN | 在庫の最終所有者 |
| Manager Domain | MANAGERDOMAIN | 運用・管理主体 |
| Manager Country | 管理主体の国 | 海外 SSP / 代理運用の把握 |
| Notification Code | OK / WARNING / ERROR | 機械的検証結果 |
| Last Updated | 最終クロール日時 | 更新頻度・鮮度確認 |

## app-ads.txt 表示項目一覧
app-ads.txt モードでは、**アプリ開発者視点（アプリ起点）**での正当性確認に必要な情報が並びます。

表示項目は ads.txt と同様です。

## sellers.json 表示項目一覧

sellers.json モードでは、**SSP / Exchange 視点（販売者起点）**での構造把握が中心です。

| 表示項目 | 内容 | 実務的な意味 |
| --- | --- | --- |
| Seller ID | sellers.json 上の seller_id | 販売主体の一意識別子 |
| Seller Name | 販売者名 | 会社名・組織名 |
| Seller Type | PUBLISHER / INTERMEDIARY / BOTH | 役割の分類 |
| Domain | Seller のドメイン | 組織の公式ドメイン |
| Country | 国コード | 法域・地域把握 |
| Is Confidential | true / false | 情報非公開設定 |
| Is Passthrough | true / false | 在庫を横流ししているか |
| Parent Seller ID | 親 seller_id | 階層構造（代理関係） |
| Notification Code | OK / WARNING / ERROR | フォーマット・整合性検証 |
| Last Updated | 最終更新日時 | sellers.json 更新確認 |


## 実装検討結果 / ステータス

### 実装方針
- **Frontend**:
  - メインページ (`/`) を「ドメインベース検索」に刷新しました。
  - タブ切り替え (`ads.txt`, `app-ads.txt`, `sellers.json`) を実装しました。
  - `ads.txt` / `app-ads.txt`: 既存の Backend API (`GET /validate`) を使用し、検索と同時に `save=true` で監視対象への自動登録を行う想定で実装しました。
  - `sellers.json`: 新規 API (`GET /api/sellers/fetch`) を想定して実装しました（Backend実装待ち）。
  - クライアントサイドでのフィルタリング、CSVダウンロード機能を実装しました。
- **Backend (次回以降の課題)**:
  - `GET /validate` 時に `save=true` が指定された場合、自動的に `monitored_domains` に追加するロジックの実装（Monitor要件定義待ち）。
  - `GET /api/sellers/fetch` APIの実装（指定ドメインから sellers.json をオンデマンド取得・パースして返す機能）。

### 不明点・課題
- `sellers.json` のオンデマンド取得APIの仕様詳細（キャッシュ戦略、エラー時の挙動など）。現在は仮のエンドポイントで実装しています。
