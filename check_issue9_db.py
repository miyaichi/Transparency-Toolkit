#!/usr/bin/env python3
"""
Issue #9 修正後 DB 状態確認スクリプト
実行方法: python3 check_issue9_db.py
前提: cloud-sql-proxy が起動していること
"""

import psycopg2
from datetime import datetime

# Issue #9 で報告されたドメイン
ISSUE9_DOMAINS = [
    'advertising.com',
    'tremorhub.com',
    'telaria.com',
    'freewheel.com',
    'criteo.com',
    'adcolony.com',
    'loopme.com',
    'opera.com',
    'synacor.com',
    'yandex.com',
    'pangleglobal.com'
]

def main():
    try:
        conn = psycopg2.connect(
            host='127.0.0.1', port=5434,
            dbname='ttkit_db', user='postgres',
            password='WqdYyiCVKWXGMtaEIxZtHztyXifMK650'
        )
        cursor = conn.cursor()

        print("\n" + "=" * 90)
        print("Issue #9 修正後 DB 状態確認")
        print("=" * 90)
        print(f"\n実行時刻: {datetime.now().isoformat()}\n")

        # 集約クエリで確認
        cursor.execute(f'''
            SELECT 
                rsf.domain,
                MAX(rsf.fetched_at) as latest_fetch,
                MAX(rsf.http_status) as http_status,
                MAX(rsf.processed_at) as processed_at,
                COUNT(DISTINCT sc.seller_id) as seller_count
            FROM raw_sellers_files rsf
            LEFT JOIN sellers_catalog sc ON rsf.domain = sc.domain
            WHERE rsf.domain = ANY(%s)
            GROUP BY rsf.domain
            ORDER BY rsf.domain
        ''', (ISSUE9_DOMAINS,))

        print(f"{'Domain':<25} {'HTTP':<6} {'Sellers':<10} {'Status':<20}")
        print("-" * 90)

        success_count = 0
        total_count = 0

        for row in cursor.fetchall():
            domain, fetched, http_status, processed, seller_count = row
            total_count += 1
            
            if http_status == 200 and seller_count > 0:
                status = "✅ SUCCESS"
                success_count += 1
            elif http_status == 200 and seller_count == 0:
                status = "⚠️  FETCHED (no sellers)"
            elif http_status and http_status >= 400:
                status = f"❌ HTTP ERROR"
            else:
                status = "❌ NOT FETCHED"

            http_str = str(http_status) if http_status else "NULL"
            print(f"{domain:<25} {http_str:<6} {seller_count:<10} {status:<20}")

        print("\n" + "=" * 90)
        print(f"結果: {success_count}/{total_count} 成功")
        print("=" * 90 + "\n")

        # 詳細情報
        if success_count == total_count:
            print("✅ 全ドメイン正常 - Issue #9 修正が成功しました！")
        else:
            print(f"⚠️  {total_count - success_count} ドメインでまだ問題あり")
            print("\n詳細確認:")
            cursor.execute(f'''
                SELECT 
                    rsf.domain,
                    rsf.http_status,
                    rsf.etag,
                    rsf.processed_at,
                    rsf.fetched_at
                FROM raw_sellers_files rsf
                WHERE rsf.domain = ANY(%s)
                ORDER BY rsf.domain, rsf.fetched_at DESC
            ''', (ISSUE9_DOMAINS,))

            current_domain = None
            for domain, http_status, etag, processed, fetched in cursor.fetchall():
                if domain != current_domain:
                    print(f"\n{domain}:")
                    current_domain = domain
                print(f"  - Fetched: {fetched}")
                print(f"  - HTTP: {http_status}")
                print(f"  - Processed: {processed}")

        conn.close()

    except Exception as e:
        print(f"❌ エラー: {e}")
        print("\n前提条件を確認してください:")
        print("  1. cloud-sql-proxy が起動していること")
        print("  2. GCP 認証が有効であること")
        print("\n実行方法:")
        print("  cloud-sql-proxy apti-ttkit:asia-northeast1:ttkit-db-instance --port=5434 &")

if __name__ == '__main__':
    main()
