
# Table Schema
SELECT
  column_name,
  data_type
FROM
  information_schema.columns
WHERE
  table_name = 'sellers_catalog';

## Result
[
  {
    "column_name": "raw_file_id",
    "data_type": "uuid"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone"
  },
  {
    "column_name": "is_confidential",
    "data_type": "boolean"
  },
  {
    "column_name": "identifiers",
    "data_type": "jsonb"
  },
  {
    "column_name": "attributes",
    "data_type": "jsonb"
  },
  {
    "column_name": "seller_id",
    "data_type": "text"
  },
  {
    "column_name": "certification_authority_id",
    "data_type": "text"
  },
  {
    "column_name": "domain",
    "data_type": "text"
  },
  {
    "column_name": "seller_type",
    "data_type": "text"
  },
  {
    "column_name": "name",
    "data_type": "text"
  },
  {
    "column_name": "seller_domain",
    "data_type": "text"
  }
]

# Indexes

SELECT
  *
FROM
  pg_indexes
WHERE
  tablename = 'sellers_catalog';

## Result

[
  {
    "schemaname": "public",
    "tablename": "sellers_catalog",
    "indexname": "sellers_catalog_pkey",
    "tablespace": "",
    "indexdef": "CREATE UNIQUE INDEX sellers_catalog_pkey ON public.sellers_catalog USING btree (domain, seller_id)"
  },
  {
    "schemaname": "public",
    "tablename": "sellers_catalog",
    "indexname": "idx_sellers_catalog_domain",
    "tablespace": "",
    "indexdef": "CREATE INDEX idx_sellers_catalog_domain ON public.sellers_catalog USING btree (domain)"
  },
  {
    "schemaname": "public",
    "tablename": "sellers_catalog",
    "indexname": "idx_sellers_catalog_seller_id",
    "tablespace": "",
    "indexdef": "CREATE INDEX idx_sellers_catalog_seller_id ON public.sellers_catalog USING btree (seller_id)"
  },
  {
    "schemaname": "public",
    "tablename": "sellers_catalog",
    "indexname": "idx_sellers_catalog_name_trgm",
    "tablespace": "",
    "indexdef": "CREATE INDEX idx_sellers_catalog_name_trgm ON public.sellers_catalog USING gin (name gin_trgm_ops)"
  },
  {
    "schemaname": "public",
    "tablename": "sellers_catalog",
    "indexname": "idx_sellers_catalog_domain_trgm",
    "tablespace": "",
    "indexdef": "CREATE INDEX idx_sellers_catalog_domain_trgm ON public.sellers_catalog USING gin (domain gin_trgm_ops)"
  },
  {
    "schemaname": "public",
    "tablename": "sellers_catalog",
    "indexname": "idx_sellers_catalog_seller_id_trgm",
    "tablespace": "",
    "indexdef": "CREATE INDEX idx_sellers_catalog_seller_id_trgm ON public.sellers_catalog USING gin (seller_id gin_trgm_ops)"
  },
  {
    "schemaname": "public",
    "tablename": "sellers_catalog",
    "indexname": "idx_sellers_catalog_seller_domain_trgm",
    "tablespace": "",
    "indexdef": "CREATE INDEX idx_sellers_catalog_seller_domain_trgm ON public.sellers_catalog USING gin (seller_domain gin_trgm_ops)"
  },
  {
    "schemaname": "public",
    "tablename": "sellers_catalog",
    "indexname": "idx_sellers_catalog_cert_auth",
    "tablespace": "",
    "indexdef": "CREATE INDEX idx_sellers_catalog_cert_auth ON public.sellers_catalog USING btree (domain, certification_authority_id)"
  }
]

# Primary key

SELECT
  indexname,
  indexdef
FROM
  pg_indexes
WHERE
  tablename = 'sellers_catalog'
  AND indexname LIKE '%_pkey';

## Result

[
  {
    "indexname": "sellers_catalog_pkey",
    "indexdef": "CREATE UNIQUE INDEX sellers_catalog_pkey ON public.sellers_catalog USING btree (domain, seller_id)"
  }
]