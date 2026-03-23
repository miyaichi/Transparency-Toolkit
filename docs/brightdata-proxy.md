# Bright Data プロキシによる ads.txt 取得の403回避

> **ステータス**: 実装・動作確認済み（2026-03-24）

## 背景

Cloud Run（または他のクラウドサービス）からサードパーティサイトの `ads.txt` / `app-ads.txt` を取得する際、一部サイトで **HTTP 403** が返される問題があります。

### 原因

```
[Cloud Run] ─── Google Cloud のIPアドレス ──→ [ddnavi.com / CloudFront + AWS WAF]
                                                        ↓
                                               Google Cloud IP をブロック → 403
```

- **Cloud RunのアウトバウンドIPはGoogleのクラウドIPレンジ**に属する
- CloudFront + AWS WAF を使用するサイトがクラウドIPをボット判定でブロックするケースがある
- IAB TechLab の Data Explorer は AWS WAF の Verified Bots リストに登録済みのため取得可能

### curlとサーバーの挙動の違い

| 環境 | 結果 |
|---|---|
| ローカルMacからcurl | 200 ✅ |
| ローカルのNode.js（同じコード） | 200 ✅ |
| Cloud Run（デプロイ済みサーバー） | 403 ❌ |

## 解決策

**[Bright Data](https://brightdata.com/) のResidential Proxyを経由したフォールバック取得**を実装しました。

- Bright DataはISP/住宅用IPを使用するため、クラウドIPのブロックを回避できる
- 直接取得が成功した場合はBright Dataを使用しない（コスト最小化）
- 403の場合のみBright Dataにフォールバック

### コスト

| プラン | 料金 | 用途 |
|---|---|---|
| Residential Proxy | $2.5/GB | 採用 |
| Web Unlocker | $1/1,000req | WAF自動バイパスが必要な場合 |

ads.txtは軽量ファイル（数十KB）のため、GB単価のResidential Proxyでも低コスト。

---

## Bright Data セットアップ

1. [Bright Data コンソール](https://brightdata.com/) でアカウント作成
2. **Residential Proxy** ゾーンを作成（ゾーン名: `residential_proxy1`）
3. Credentialsを取得:
   - `BRIGHTDATA_USER`: `brd-customer-XXXXXXXX-zone-residential_proxy1`
   - `BRIGHTDATA_PASS`: `XXXXXXXXXXXXXXXX`

---

## 実装

### 1. `backend/src/lib/http.ts` にBright Dataフォールバック関数を追加

既存の `client`（`rejectUnauthorized: false` のHTTPSエージェント付き）を再利用し、新たなagentは作成しない。

```typescript
/**
 * Bright Data Residential Proxy 経由でコンテンツを取得する
 * 直接取得で403が返された場合のフォールバックとして使用
 */
export async function fetchViaBrightData(url: string): Promise<{ data: string; status: number }> {
  const user = process.env.BRIGHTDATA_USER;
  const pass = process.env.BRIGHTDATA_PASS;
  if (!user || !pass) throw new Error('Bright Data credentials not configured');

  const domain = new URL(url).hostname;

  const res = await client.get(url, {
    proxy: {
      host: 'brd.superproxy.io',
      port: 22225,
      auth: { username: user, password: pass },
    },
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'text/plain,text/html,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `https://${domain}/`,
    },
    timeout: 15000,
    maxRedirects: 5,
  });

  return {
    data: typeof res.data === 'string' ? res.data : String(res.data),
    status: res.status,
  };
}
```

### 2. `backend/src/services/adstxt_scanner.ts` の `fetchRawContent` を修正

```typescript
import client, { fetchViaBrightData } from '../lib/http';

// fetchRawContent の内側 catch（HTTPS・HTTP 両方失敗時）:
} catch (inner: any) {
  // 403 かつ Bright Data が設定されている場合はフォールバック
  const status = inner.response?.status ?? (e as any).response?.status;
  if (status === 403 && process.env.BRIGHTDATA_USER) {
    console.warn(`[adstxt] Direct fetch blocked (403) for ${domain}, retrying via Bright Data`);
    const result = await fetchViaBrightData(`https://${domain}/${filename}`);
    return {
      content: result.data,
      finalUrl: `https://${domain}/${filename}`,
      statusCode: result.status,
    };
  }
  statusCode = inner.response?.status || 0;
  throw inner;
}
```

### 3. CI/CD（GitHub Actions）への組み込み

`deploy-gcp.yml` の Cloud Run デプロイステップの `--set-env-vars` に追記済み:

```yaml
--set-env-vars ...,BRIGHTDATA_USER=${{ secrets.BRIGHTDATA_USER }},BRIGHTDATA_PASS=${{ secrets.BRIGHTDATA_PASS }}
```

GitHub Actions の Secrets（`BRIGHTDATA_USER` / `BRIGHTDATA_PASS`）に登録済みのため、デプロイ時に自動的に Cloud Run へ環境変数として渡される。

### 4. ローカル開発用 `.env`

```bash
# backend/.env
BRIGHTDATA_USER=brd-customer-XXXXXXXX-zone-residential_proxy1
BRIGHTDATA_PASS=XXXXXXXXXXXXXXXX
```

---

## 動作フロー

```
fetchRawContent(domain)
    │
    ├─ HTTPS直接取得 → 成功 → 返す
    │
    ├─ HTTPS失敗 → HTTP直接取得 → 成功 → 返す
    │
    └─ HTTP失敗 (403) かつ BRIGHTDATA_USER 設定あり
            │
            └─ Bright Data Residential Proxy 経由 → 取得 → 返す
```

---

## 注意事項

- **既存の `client` を再利用**: `http.ts` の `client` はすでに `rejectUnauthorized: false` のHTTPSエージェントを持つため、Bright DataのSSLインターセプトに対応済み。
- **環境変数が未設定の場合はBright Dataをスキップ**: 既存の動作に影響しない。
- **403以外のエラー**（タイムアウト、DNS解決失敗など）ではBright Dataにフォールバックしない。

---

## 将来的な対応

AWS WAF の [Verified Bots プログラム](https://aws.amazon.com/waf/features/bot-control/) に登録することで、Bright Dataを使わずにIPブロックを回避できる可能性があります。また、Cloudflareは [RFC 9421（HTTP Message Signatures）](https://blog.cloudflare.com/verified-bots-with-cryptography/) を使ったボット認証を導入しており、業界標準として普及した場合は別途対応が必要になります。
