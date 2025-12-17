import { createValidationMessage } from '../lib/adstxt/messages';
import { crossCheckAdsTxtRecords, parseAdsTxtContent } from '../lib/adstxt/validator';
import client from '../lib/http';
import { AdsTxtScanner } from './adstxt_scanner';
import { DbSellersProvider } from './db_sellers_provider';

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
  warning_params?: any;
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

  constructor() {
    this.scanner = new AdsTxtScanner();
    this.sellersProvider = new DbSellersProvider();
  }

  async validateDomain(domain: string, type: string = 'ads.txt', save: boolean = false): Promise<ValidationResult> {
    let content = '';
    let finalUrl = '';
    let scanId: string | undefined;

    // Validate/Normalize type
    const fileType = (type === 'app-ads.txt' ? 'app-ads.txt' : 'ads.txt');

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
    const validatedEntries = await crossCheckAdsTxtRecords(domain, parsedEntries, null, this.sellersProvider);

    // 4. Format Records
    const formattedRecords: ValidationRecord[] = validatedEntries.map((entry) => {
      let warning_message = undefined;

      // Cast to access potential properties of both Record and Variable types safely
      const record = entry as any;

      if (record.validation_key) {
        const msg = createValidationMessage(record.validation_key, [], 'en');
        if (msg) warning_message = msg.message;
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
      };
    });

    // 5. Calculate Stats
    const validRecords = formattedRecords.filter((r) => r.is_valid);
    const direct_count = validRecords.filter(
      (r) => r.relationship && r.relationship.toUpperCase() === 'DIRECT',
    ).length;
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
    const fileType = type === 'app-ads.txt' ? 'app-ads.txt' : (type === 'ads.txt' ? 'ads.txt' : undefined);
    return this.scanner.getHistory(domain, limit, fileType);
  }
}
