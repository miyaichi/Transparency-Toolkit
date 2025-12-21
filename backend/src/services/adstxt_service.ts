import { createValidationMessage } from '../lib/adstxt/messages';
import { diagnoseLine } from '../lib/adstxt/normalizer';
import { crossCheckAdsTxtRecords, parseAdsTxtContent } from '../lib/adstxt/validator';
import client from '../lib/http';
import { AdsTxtScanner } from './adstxt_scanner';
import { DbSellersProvider } from './db_sellers_provider';

import { SellersService } from './sellers_service';

export interface ValidationRecord {
  line_number: number;
  raw_line: string;
  is_valid: boolean;
  domain?: string;
  account_id?: string;
  account_type?: string;
  certification_authority_id?: string;
  relationship?: string;
  variable_type?: string;
  value?: string;
  has_warning?: boolean;
  validation_key?: string;
  warning?: string;
  warning_message?: string;
  severity?: string;
  seller_name?: string;
  seller_domain?: string;
  seller_type?: string;
  is_confidential?: number;
}

export interface ValidationStats {
  total: number;
  valid: number;
  invalid: number;
  warnings: number;
  direct_count: number;
  reseller_count: number;
}

export interface ValidationResult {
  domain: string;
  ads_txt_url: string;
  records: ValidationRecord[];
  stats: ValidationStats;
  scan_id?: string;
  error?: string;
}

export class AdsTxtService {
  private scanner: AdsTxtScanner;
  private sellersProvider: DbSellersProvider;
  private sellersService: SellersService;

  constructor() {
    this.scanner = new AdsTxtScanner();
    this.sellersProvider = new DbSellersProvider();
    this.sellersService = new SellersService();
  }

  async validateDomain(domain: string, type: string = 'ads.txt', save: boolean = false): Promise<ValidationResult> {
    let content = '';
    let finalUrl = '';
    let scanId: string | undefined;

    // Validate/Normalize type
    const fileType = type === 'app-ads.txt' ? 'app-ads.txt' : 'ads.txt';

    // 1. Fetch
    if (save) {
      try {
        const scanResult = await this.scanner.scanAndSave(domain, fileType);
        content = scanResult.content || '';
        finalUrl = scanResult.url;
        scanId = scanResult.id;

        if (!content && scanResult.error_message) {
          throw new Error(`Failed to fetch ${fileType}: ${scanResult.error_message}`);
        }
      } catch (e: any) {
        throw new Error(e.message);
      }
    } else {
      // Ephemeral Fetch
      try {
        try {
          finalUrl = `https://${domain}/${fileType}`;
          const res = await client.get(finalUrl, { maxRedirects: 5 });
          content = res.data;
        } catch {
          // Fallback to HTTP
          finalUrl = `http://${domain}/${fileType}`;
          const res = await client.get(finalUrl, { maxRedirects: 5 });
          content = res.data;
        }
        if (typeof content !== 'string') content = JSON.stringify(content);
      } catch (err: any) {
        throw new Error(`Failed to fetch ${fileType} from ${domain}: ${err.message}`);
      }
    }

    // 2. Validate Content Format
    const upperContent = content.trim().toUpperCase();
    if (upperContent.startsWith('<!DOCTYPE') || upperContent.startsWith('<HTML') || upperContent.startsWith('<HEAD')) {
      throw new Error(`Invalid ${fileType} format: The server returned an HTML page instead of a text file.`);
    }

    // 3. Parse & Check
    const parsedEntries = parseAdsTxtContent(content, domain);

    // Auto-fetch missing sellers.json to ensure validation accuracy
    const systemDomains = new Set<string>();
    parsedEntries.forEach((entry: any) => {
      if (entry.domain) {
        systemDomains.add(entry.domain.toLowerCase());
      }
    });

    await Promise.all(
      Array.from(systemDomains).map(async (sysDomain) => {
        try {
          const has = await this.sellersProvider.hasSellerJson(sysDomain);
          if (!has) {
            // Fire and forget to avoid timeout on large files (e.g. Google)
            this.sellersService.fetchAndProcessSellers(sysDomain, true).catch((err) => {
              console.warn(`Background fetch failed for ${sysDomain}:`, err);
            });
          }
        } catch (e) {
          console.warn(`Failed to auto-fetch sellers.json for ${sysDomain}:`, e);
        }
      }),
    );

    const validatedEntries = await crossCheckAdsTxtRecords(domain, parsedEntries, null, this.sellersProvider);

    // 3.5. Optimize: Batch fetch seller info for all records
    // Group account IDs by system domain (ads.txt lines refer to system domains)
    const accountsByDomain = new Map<string, Set<string>>();

    validatedEntries.forEach((entry: any) => {
      // entry.domain is the system domain (e.g. google.com)
      // entry.account_id is the seller ID
      if (entry.domain && entry.account_id) {
        const sysDomain = entry.domain.toLowerCase();
        if (!accountsByDomain.has(sysDomain)) {
          accountsByDomain.set(sysDomain, new Set());
        }
        accountsByDomain.get(sysDomain)?.add(entry.account_id);
      }
    });

    // Fetch sellers info in parallel batches
    const sellerLookup = new Map<string, any>(); // Key: "sysDomain:accountId" -> Seller Object

    await Promise.all(
      Array.from(accountsByDomain.entries()).map(async ([sysDomain, accountIds]) => {
        try {
          const result = await this.sellersProvider.batchGetSellers(sysDomain, Array.from(accountIds));
          result.results.forEach((r) => {
            if (r.found && r.seller) {
              sellerLookup.set(`${sysDomain}:${r.sellerId}`, r.seller);
            }
          });
        } catch (e) {
          console.warn(`Failed to batch fetch sellers for ${sysDomain}:`, e);
          // Continue without seller info for this domain
        }
      }),
    );

    // 4. Format Records
    const formattedRecords: ValidationRecord[] = validatedEntries.map((entry) => {
      let warning_message = undefined;

      // Cast to access potential properties of both Record and Variable types safely
      const record = entry as any;

      if (record.validation_key) {
        const msg = createValidationMessage(record.validation_key, [], 'en');
        if (msg) warning_message = msg.message;
      } else if (!record.is_valid && record.raw_line) {
        // Try to diagnose invalid records that don't have a specific validation key yet
        const diagnosis = diagnoseLine(record.raw_line);
        if (diagnosis) {
          record.validation_key = diagnosis;
          // We can set a fallback warning message here or let the frontend translate it
          warning_message = diagnosis;
        }
      }

      // Populate seller info if available
      let sellerInfo: any = undefined;
      if (record.domain && record.account_id) {
        sellerInfo = sellerLookup.get(`${record.domain.toLowerCase()}:${record.account_id}`);
      }

      return {
        line_number: record.line_number,
        raw_line: record.raw_line,
        is_valid: record.is_valid,
        domain: record.domain,
        account_id: record.account_id,
        account_type: record.account_type,
        certification_authority_id: record.certification_authority_id,
        relationship: record.relationship,
        variable_type: record.variable_type,
        value: record.value,
        has_warning: record.has_warning,
        validation_key: record.validation_key,
        warning: record.warning,
        severity: record.severity,
        warning_params: record.warning_params,
        warning_message,
        // Seller Info
        seller_name: sellerInfo?.name,
        seller_domain: sellerInfo?.domain,
        seller_type: sellerInfo?.seller_type,
        is_confidential: sellerInfo?.is_confidential,
      };
    });

    // 5. Calculate Stats
    const validRecords = formattedRecords.filter((r) => r.is_valid);
    const direct_count = validRecords.filter((r) => r.relationship && r.relationship.toUpperCase() === 'DIRECT').length;
    const reseller_count = validRecords.filter(
      (r) => r.relationship && r.relationship.toUpperCase() === 'RESELLER',
    ).length;

    const stats = {
      total: formattedRecords.length,
      valid: validRecords.length,
      invalid: formattedRecords.filter((r) => !r.is_valid).length,
      warnings: formattedRecords.filter((r) => r.has_warning).length,
      direct_count,
      reseller_count,
    };

    return {
      domain,
      ads_txt_url: finalUrl,
      records: formattedRecords,
      stats,
      scan_id: scanId,
    };
  }

  async getHistory(domain: string | undefined, limit: number, type: string | undefined) {
    const fileType = type === 'app-ads.txt' ? 'app-ads.txt' : type === 'ads.txt' ? 'ads.txt' : undefined;
    return this.scanner.getHistory(domain, limit, fileType);
  }
}
