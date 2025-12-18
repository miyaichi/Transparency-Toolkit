# Request from private beta testers

## Optimizerの結果表示

### 現状

Optimizeの実行結果で行数が変わらない場合は、No issues foundを表示するようにしているが、不適切な行をコメントアウトしている場合も、No issues foundを表示されてしまう。

### 要望

行数が変わった時はそのまま。行数が変わらない時は、コメントアウトされた行があることを表示するか、行数は変わっていないと表示する。

## Domainの入力

### 現状

asahi.comなどのドメインを入力する欄で、間違って https://asahi.com と入力してしまい、入力エラーとなる

### 要望

adstxt-validatorが使われているので、psl(public suffix list)が利用可能なので、pslを使って、入力からルートドメインを抽出して、入力とするようにする。

## Data ExprolerのCSV出力

### 現状

ads.txt/app-ads.txt/sellers.jsonの選択肢があり、それぞれのデータを表示、CSV出力できる。

### 要望

チェックボックス、あるいは、supply-chain (ads.txt)、supply-chain (app-ads.txt)といった選択肢を用意し、ads.txt/app-ads.txtとsellers.jsonを結合したデータをCSV出力、表示できるようにする。データは下記の項目をすべて含む。

ads.txt/app-ads.txt
Line, Advertising System, Publisher Account ID, Relationship, Cert ID, Comment / Raw

sellers.json
Seller ID, Name, Type, Domain, Identifiers, Confidential, Passthrough

## Ads.txt Validatorの横スクロール

### 現状

Ads.txt Validatorの結果は、エラーや警告がある行は黄色などの色が付けられているが、横スクロールすると、新しく表示された部分に色がつかない。

### 要望

横スクロールすると、新しく表示された部分にも色がつけるようにする。

## スキャン対象の選定

### 現状

Ads.txt Validatorを実行したドメインはスキャン対象になるが、Optimizeを実行したドメインはスキャン対象となっていないように思われる。

### 要望

Ads.txt Validator/Data Explorer/Insite Analytics/Optimizerのすべてのメニューで入力されたドメインは、スキャン対象となるようにする。

## 検証コード一覧ページの活用

### 現状

検証コード一覧ページは、ads.txt/app-ads.txt/sellers.jsonのいずれかを表示することができる。

### 要望

検証コード一覧ページは、検証のエラーを表示しているが、Ads.txt Validatorからリンクできていない。

### 要望

adstxt-validatorの結果が返す、helpUrlを活用し、Ads.txt Validatorのエラーや警告の説明から、別ページで立ち上げた検証コード一覧ページの該当箇所を表示し、目立つよう、一時的にハイライトしてほしい。

## OptimizerのStepの順番

### 現状

OptimizerのStepの順番は、1. CleanUp, 2. Owner Domain Verification, 3. Relationship Correction, 4. Manager Domain Optimization, 5. Sellers.json Verificationとなっている。

### 要望

Optimizeを行う側から考えると、3. Manager Domain Optimization, 4. Relationship Correction の方が実務にあっている。

## OptimizerのStepの解説

### 現状

OptimizerのStepの処理内容は項目のすぐ下に短い文章で説明されている。

### 要望

そのstepが何を意味しているか、どんなリスク・メリットがあるかといった解説ページを用意し、Optimizetionの各ステップから解説ページにリンクできる様にする。

