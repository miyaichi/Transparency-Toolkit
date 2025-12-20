# Ads.txt 検証警告ガイド

このドキュメントでは、Transparency Toolkitで表示される可能性のある検証警告とエラーについて説明します。各警告には、問題の説明と解決方法の推奨事項が含まれています。

## ファイルアクセスエラー

<a id="file-not-found"></a>

### ファイルが見つからない（コード: 10010）

**説明**: 登録されたads.txtまたはapp-ads.txtファイルが存在しません。

**推奨事項**: ドメインルートにads.txtファイル（domain.com/ads.txt）またはapp-ads.txtファイル（developerurl.com/app-ads.txt）を作成してください。

---

<a id="invalid-content-type"></a>

### 無効なコンテンツタイプ（コード: 10020）

**説明**: ファイルがHTTPリクエストヘッダー「Content-Type: text/plain」で提供されていません。

**推奨事項**: サーバーがContent-Type: text/plainでファイルを返すように設定してください。UTF8サポートを明示するために、「Content-Type: text/plain; charset=utf-8」の使用も推奨されます。

---

<a id="timeout"></a>

### タイムアウト（コード: 10030）

**説明**: クローラーがads.txtまたはapp-ads.txtファイルにアクセスしようとした際にタイムアウトが発生しました。

**推奨事項**: サーバーの応答時間を確認し、20秒以内にファイルが取得できるようにしてください。

---

<a id="too-many-redirects"></a>

### リダイレクト制限超過（コード: 10040, 10050）

**説明**: ファイルへのアクセス時にリダイレクト制限を超えています。

**推奨事項**: ルートドメイン内では最大5つのリダイレクト、ルートドメイン外では最大1つのリダイレクトに制限してください。

---

## 無効なフォーマットエラー

<a id="invalid-format"></a>

### 無効なフォーマット

**説明**: Ads.txtエントリのフォーマットが無効で、正しく解析できませんでした。Ads.txtエントリは特定のカンマ区切りフォーマットに従う必要があります。

**推奨事項**: エントリが`domain.com, account_id, DIRECT|RESELLER, certification_authority_id`というフォーマットに従っていることを確認してください。認証局IDはオプションです。

---

<a id="missing-fields"></a>

### 必須フィールドの欠落（コード: 11010）

**説明**: ads.txtエントリに必要な3つのフィールドがありません。各エントリには少なくとも2つのカンマを含み、広告システムドメイン、アカウントID、およびアカウントタイプ（DIRECTまたはRESELLER）が必要です。

**推奨事項**: エントリが`domain.com, account_id, DIRECT|RESELLER, certification_authority_id`というフォーマットですべての必須フィールドが含まれていることを確認してください。

---

<a id="no-valid-entries"></a>

### 有効なエントリがない（コード: 11040）

**説明**: ads.txtファイルに有効なエントリが見つかりません。2020年3月以降、空のファイルは認可されたデジタル販売者がいないことを宣言する方法として受け入れられなくなりました。

**推奨事項**: 認可されたデジタル販売者がいない場合は、プレースホルダーエントリとして `placeholder.example.com, placeholder, DIRECT, placeholder` を使用してください。

---

<a id="whitespace-in-fields"></a>

### フィールド内の空白（コード: 11050）

**説明**: フィールドにタブ、カンマ、または空白が含まれています。

**推奨事項**: フィールドにタブ、カンマ、または空白が含まれている場合は、URLエンコーディングでエスケープする必要があります。

---

## 関係タイプの警告

<a id="invalid-relationship"></a>

### 無効な関係タイプ（コード: 11020）

**説明**: 3番目の必須フィールドには「DIRECT」または「RESELLER」のいずれかが含まれている必要があります。「DIRECT」は、パブリッシャー（コンテンツ所有者）がフィールド#1のシステム上でフィールド#2に示されるアカウントを直接制御していることを示します。これは通常、パブリッシャーと広告システム間の直接の業務契約を意味します。「RESELLER」は、パブリッシャーが他のエンティティにフィールド#2に示されるアカウントを制御し、フィールド#1のシステムを介して広告スペースを再販する権限を与えたことを示します。

**推奨事項**: 関係タイプをDIRECTまたはRESELLERに変更してください。

---

## ドメインの警告

<a id="invalid-domain"></a>

### 無効なドメイン（コード: 11030）

**説明**: 広告システムドメインが有効なドメインではありません。フィールド#1の識別子は、RFC 1123に従った有効なDNSドメイン名である必要があります。

**推奨事項**: 広告システムのドメイン名が有効なドメインであることを確認してください。

---

<a id="empty-account-id"></a>

### 空のアカウントID

**説明**: アカウントIDフィールドが空です。すべてのads.txtエントリにはアカウントIDが含まれている必要があります。

**推奨事項**: 広告システムのプラットフォームでのパブリッシャーIDである有効なアカウントIDを提供してください。

---

## 実施済みエントリの情報

<a id="implimented-entry"></a>

### 実施済みエントリ

**説明**: 指定されたドメインのads.txtファイルに同一のエントリが既に存在します。

**推奨事項**: 新規エントリに実施済みエントリを含める必要はありません。既存のエントリはすでに有効であり、重複する必要はありません。

---

## Sellers.json検証の警告

<a id="no-sellers-json"></a>

### Sellers.jsonファイルがない（コード: 12010, 13010）

**説明**: このDIRECT/RESELLERエントリに記載されている広告システムドメインにsellers.jsonファイルがhttp://{advertising_system_domain}/sellers.jsonに存在しません。

**推奨事項**: 販売パートナーに連絡して、sellers.jsonを実装するよう依頼してください。これは情報提供の警告であり、エントリを続行できますが、sellers.jsonとのクロス検証はできません。

---

<a id="direct-account-id-not-in-sellers-json"></a>

### DIRECT: アカウントIDがSellers.jsonにない（コード: 12020）

**説明**: リストされている広告システムには、そのsellers.jsonファイルにあなたのパブリッシャーアカウントIDがseller_idとして記載されていません。

**推奨事項**: 販売者と連携していない場合は、ファイルからこのエントリを削除してください。アカウントIDが正しいことを確認し、関係が本当にDIRECTである場合、広告システムはsellers.jsonファイルにあなたのパブリッシャーIDを含める必要があります。

---

<a id="reseller-account-id-not-in-sellers-json"></a>

### RESELLER: アカウントIDがSellers.jsonにない（コード: 13020）

**説明**: リストされている広告システムには、そのsellers.jsonファイルにあなたのパブリッシャーアカウントIDがseller_idとして記載されていません。

**推奨事項**: 販売者と連携していない場合は、ファイルからこのエントリを削除してください。アカウントIDが正しいことを確認し、リセラーを使用している場合、そのIDは広告システムのsellers.jsonファイルに含まれているはずです。

---

<a id="domain-mismatch"></a>

### ドメインの不一致（コード: 12030, 13030）

**説明**: 指定されたアカウントIDでリストされているビジネスドメインです。

**推奨事項**: 期待通りにリストされていることを確認してください。ドメインが存在する場合、それは指定されたseller_idの下で取引される在庫に対して支払いを受ける会社（法人）のビジネスドメイン名である必要があります。

---

<a id="direct-not-publisher"></a>

### DIRECT: セラーがPUBLISHERとしてマークされていない（コード: 12040, 12050）

**説明**: I）このセラーIDはBOTHとしてリストされており、あなたがこの販売者と共にPUBLISHERおよびINTERMEDIARYの両方として機能していることを意味します。
II）この販売者はあなたの関係をINTERMEDIARYとしてリストしていますが、この関係に対して有効なユースケースがある場合があります。

**推奨事項**: これが正しくない場合は、ファイルが正しい関係を表示するように販売パートナーと協力してください。

---

<a id="seller-id-not-unique"></a>

### セラーIDが一意ではない（コード: 12060, 13060）

**説明**: このseller_idは広告システムのsellers.jsonファイルで複数回使用されています。これは仕様上無効です。

**推奨事項**: このIDを使用している他の販売パートナーを確認し、在庫がどのように販売されているかをより理解するために販売パートナーに連絡してください。

---

<a id="reseller-not-intermediary"></a>

### RESELLER: セラーがINTERMEDIARYとしてマークされていない（コード: 13040, 13050）

**説明**: I）このセラーIDはBOTHとしてリストされており、PUBLISHERとINTERMEDIARYの両方として機能していることを意味します。
II）この販売者はあなたの関係をPUBLISHERとしてリストしており、これはあなたがリストしているRESELLER関係とは異なります。

**推奨事項**: これが正しくない場合は、ファイルが正しい関係を表示するように販売パートナーと協力してください。

---

<a id="sellers-json-validation-error"></a>

### Sellers.json検証エラー

**説明**: 広告システムのsellers.jsonファイルとの検証中にエラーが発生しました。

**推奨事項**: これは通常、一時的または技術的なエラーです。エントリを続行できますが、sellers.jsonとの完全な検証ができなかったことに注意してください。後で再試行することを検討してください。

---

## サブドメイン検証の警告

<a id="invalid-subdomain-url"></a>

### 無効なサブドメインURL（コード: 14020）

**説明**: リストされているサブドメインが有効なURLではありません。

**推奨事項**: サブドメインが有効なURLであることを確認してください。

---

<a id="invalid-subdomain"></a>

### 無効なサブドメイン（コード: 14030）

**説明**: リストされているサブドメインがads.txtファイルのルートドメインのサブドメインではありません。

**推奨事項**: サブドメインがads.txtファイルが見つかったルートドメインのサブドメインであることを確認してください。

---

<a id="invalid-subdomain-ads-txt"></a>

### 無効なサブドメインAds.txt（コード: 14040）

**説明**: サブドメインに有効なads.txtファイルがありません。

**推奨事項**: サブドメインにsubdomain.domain.com/ads.txtに有効なads.txtファイルがリストされていることを確認してください。

---

<a id="subdomain-not-listed"></a>

### サブドメインが記載されていない（コード: 14050）

**説明**: サブドメインがルートドメインのads.txtファイルにsubdomain=として記載されていません。

**推奨事項**: クロールされるサブドメインはルートドメインのads.txtファイルにsubdomain=を使用してのみリストされるべきです。

---

<a id="subdomain-contains-subdomains"></a>

### サブドメインにサブドメインが含まれている（コード: 14060）

**説明**: サブドメインには他のサブドメインを含めることはできません。

**推奨事項**: サブドメインのads.txtファイルにさらにsubdomain=リストを含めないでください。

---

## インベントリパートナードメイン検証の警告

<a id="invalid-inventory-partner-domain"></a>

### 無効なインベントリパートナードメイン（コード: 15020）

**説明**: "inventorypartnerdomain=programmerA.com"にリストされているドメインに有効なads.txtファイルがありません。

**推奨事項**: programmerA.com/ads.txtに有効なads.txtファイルがあることを確認してください。

---

<a id="inventory-partner-contains-partners"></a>

### インベントリパートナーにパートナーが含まれている（コード: 15030）

**説明**: "one hop"のみが許可されているため、インベントリパートナーはインベントリパートナーをリストすべきではありません。

**推奨事項**: インベントリパートナーのads.txtファイルにインベントリパートナードメインのリストが含まれていないことを確認してください。

---

## マネージャードメイン検証の警告

<a id="invalid-manager-domain"></a>

### 無効なマネージャードメイン（コード: 16010）

**説明**: managerdomain=に提供されたドメインが無効です。

**推奨事項**: managerdomain=domain.comで、domain.comが有効なURLであることを確認してください。

---

<a id="multiple-manager-domains-without-country"></a>

### 国コードのない複数のマネージャードメイン（コード: 16020）

**説明**: 複数のmanagerdomain=がある場合、各リストに国コードが関連付けられている必要があります。

**推奨事項**: 複数のmanagerdomain=がある場合、各リスティングには次の形式で国コードを関連付ける必要があります：ドメインの構文は(PSL+1ドメイン、必須)、(ISO 3166-1アルファ2国コード、オプション、空=グローバル)です。

---

<a id="invalid-country-code"></a>

### 無効な国コード（コード: 16030）

**説明**: 提供された国コードは有効なISO 3166-1アルファ2国コードではありません。

**推奨事項**: ドメインの構文は (PSL+1ドメイン、必須)、(ISO 3166-1アルファ2国コード、オプション、空=グローバル) です。

---

<a id="manager-without-sellers-json"></a>

### Sellers.jsonのないマネージャー（コード: 16040）

**説明**: managerdomain=に提供されたドメインには有効なsellers.jsonファイルがありません。

**推奨事項**: managerdomain=domain.comでリストされているドメインには、domain.com/sellers.jsonに有効なsellers.jsonファイルがあることを確認してください。

---

<a id="manager-without-entry"></a>

### エントリのないマネージャー（コード: 16050）

**説明**: ads.txtファイルには、マネージャードメインとして記載されている広告システムのエントリもあるべきです。

**推奨事項**: managerdomain=domain.comには、domain.com、ID、RELATIONSHIPなどの認可された販売者エントリもあるべきです。

---

<a id="manager-not-direct"></a>

### マネージャーがDIRECTでない（コード: 16060）

**説明**: マネージャードメインの認可された販売者エントリはDIRECT関係としてリストされるべきです。

**推奨事項**: managerdomain=domain.comには、domain.com、ID、DIRECTなどの認可された販売者エントリもあるべきです。

---

<a id="manager-sellers-json-without-id"></a>

### IDのないマネージャーSellers.json（コード: 16070）

**説明**: domain.com/sellers.jsonには、ウェブサイトのads.txtファイルからのエントリに一致する広告システムIDがありません。

**推奨事項**: managerdomain=domain.comで、domain.com/sellers.jsonにはウェブサイトのads.txtファイルのdomain.comの認可された販売者エントリからIDを使用するエントリが含まれているべきです。

---

<a id="manager-sellers-json-domain-mismatch"></a>

### マネージャーSellers.jsonドメインの不一致（コード: 16080）

**説明**: domain.com/sellers.jsonには広告システムIDのリストがありますが、販売者ドメインがウェブサイトのads.txtファイルと一致しません。

**推奨事項**: managerdomain=domain.comで、domain.com/sellers.jsonの販売者ドメインエントリはownerdomain=で見つかったドメインと一致する必要があり、ownerdomain=が存在しない場合はads.txtファイルが見つかったドメインと一致する必要があります。

---

<a id="manager-sellers-json-not-publisher"></a>

### マネージャーSellers.jsonがPUBLISHERでない（コード: 16090）

**説明**: domain.com/sellers.jsonには、ウェブサイトのads.txtファイルからのエントリに一致する広告システムIDのリストがありますが、関係はPUBLISHERとしてリストされていません。

**推奨事項**: managerdomain=domain.comで、domain.com/sellers.jsonの関係タイプはPUBLISHERであるべきです。

---

## オーナードメイン検証の警告

<a id="invalid-owner-domain"></a>

### 無効なオーナードメイン（コード: 17010）

**説明**: ownerdomain=に提供されたドメインが無効です。

**推奨事項**: ownerdomain=domain.comで、domain.comが有効なURLであることを確認してください。

---

<a id="multiple-owner-domains"></a>

### 複数のオーナードメイン（コード: 17020）

**説明**: 複数のownerdomainをリストすることは無効と見なされます。

**推奨事項**: リストされるownerdomainは1つだけにしてください。

---

<a id="owner-domain-mismatch"></a>

### オーナードメインの不一致（コード: 17030）

**説明**: ownerdomainは、指定されたアカウントIDでリストされているビジネスドメインと一致する必要があります。

**推奨事項**: パブリッシャーがownerdomain=をリストしている場合、リストされているドメインはsellers.jsonのすべてのPUBLISHERエントリのビジネスドメインリストで使用される必要があります。
