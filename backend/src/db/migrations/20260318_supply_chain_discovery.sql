-- Phase 1: Supply Chain Discovery Queue
-- Tracks domains discovered through INTERMEDIARY seller_domain references

CREATE TABLE IF NOT EXISTS supply_chain_discovery_queue (
    domain TEXT PRIMARY KEY,
    discovered_from TEXT NOT NULL,          -- 発見元ドメイン（どのSSPのsellers.jsonで見つかったか）
    depth INT NOT NULL DEFAULT 0,           -- 探索深度（0=直接のSSP, 1=depth2, 2=depth3...）
    status TEXT NOT NULL DEFAULT 'pending', -- pending / fetched / failed
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    fetched_at TIMESTAMPTZ,
    error_message TEXT,                     -- fetch失敗時のエラー
    retry_count INT DEFAULT 0,
    last_retry_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scdq_status_depth ON supply_chain_discovery_queue (status, depth);
CREATE INDEX IF NOT EXISTS idx_scdq_discovered_from ON supply_chain_discovery_queue (discovered_from);
CREATE INDEX IF NOT EXISTS idx_scdq_depth ON supply_chain_discovery_queue (depth);

-- Phase 2: Supply Chain Hops Cache
-- Pre-computed hop counts for ads.txt validation results

CREATE TABLE IF NOT EXISTS supply_chain_hops (
    publisher_domain TEXT NOT NULL,
    ssp_domain TEXT NOT NULL,
    account_id TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'ads.txt',
    hop_count INT,                          -- NULL = 解決不能（循環・未取得）
    is_resolved BOOLEAN DEFAULT false,      -- TRUE = チェーン終端（PUBLISHER）到達
    resolved_depth INT NOT NULL DEFAULT 1,  -- 何 depth まで探索したか
    chain_path TEXT[],                      -- 経路ドメイン配列（デバッグ用）
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (publisher_domain, ssp_domain, account_id, file_type)
);

CREATE INDEX IF NOT EXISTS idx_sch_publisher ON supply_chain_hops (publisher_domain, file_type);
CREATE INDEX IF NOT EXISTS idx_sch_ssp ON supply_chain_hops (ssp_domain);
CREATE INDEX IF NOT EXISTS idx_sch_resolved ON supply_chain_hops (is_resolved, resolved_depth);

-- Add comment for documentation
COMMENT ON TABLE supply_chain_discovery_queue IS 'Tracks domains to fetch sellers.json from, discovered through INTERMEDIARY references. Supports phased depth expansion (depth=0,1,2...).';
COMMENT ON TABLE supply_chain_hops IS 'Pre-computed supply chain hop counts for validator API. Updated incrementally as new sellers.json files are fetched.';
