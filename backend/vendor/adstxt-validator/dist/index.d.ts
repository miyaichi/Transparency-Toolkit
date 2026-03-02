/**
 * Utility to validate and parse Ads.txt data
 */
export declare enum Severity {
    ERROR = "error",
    WARNING = "warning",
    INFO = "info"
}
export type WarningParams = Record<string, unknown>;
export type WarningDetail = {
    key: string;
    params?: WarningParams;
    severity?: Severity;
};
export declare const VALIDATION_KEYS: {
    MISSING_FIELDS: string;
    INVALID_FORMAT: string;
    INVALID_RELATIONSHIP: string;
    INVALID_DOMAIN: string;
    EMPTY_ACCOUNT_ID: string;
    IMPLIMENTED: string;
    NO_SELLERS_JSON: string;
    DIRECT_ACCOUNT_ID_NOT_IN_SELLERS_JSON: string;
    RESELLER_ACCOUNT_ID_NOT_IN_SELLERS_JSON: string;
    DOMAIN_MISMATCH: string;
    DIRECT_NOT_PUBLISHER: string;
    SELLER_ID_NOT_UNIQUE: string;
    RESELLER_NOT_INTERMEDIARY: string;
    SELLERS_JSON_VALIDATION_ERROR: string;
    EMPTY_FILE: string;
    INVALID_CHARACTERS: string;
};
export declare const ERROR_KEYS: {
    MISSING_FIELDS: string;
    INVALID_FORMAT: string;
    INVALID_RELATIONSHIP: string;
    INVALID_DOMAIN: string;
    EMPTY_ACCOUNT_ID: string;
    IMPLIMENTED: string;
    NO_SELLERS_JSON: string;
    DIRECT_ACCOUNT_ID_NOT_IN_SELLERS_JSON: string;
    RESELLER_ACCOUNT_ID_NOT_IN_SELLERS_JSON: string;
    DOMAIN_MISMATCH: string;
    DIRECT_NOT_PUBLISHER: string;
    SELLER_ID_NOT_UNIQUE: string;
    RESELLER_NOT_INTERMEDIARY: string;
    SELLERS_JSON_VALIDATION_ERROR: string;
    EMPTY_FILE: string;
    INVALID_CHARACTERS: string;
};
export { ValidationMessage, MessageData, MessageProvider, MessageConfig, DefaultMessageProvider, SupportedLocale, setMessageProvider, getMessageProvider, createValidationMessage, configureMessages, isSupportedLocale, getSupportedLocales, } from './messages';
export interface SellersJsonProvider {
    /**
     * Get specific sellers by seller IDs for a domain
     * @param domain - The domain to fetch sellers for
     * @param sellerIds - Array of seller IDs to fetch
     * @returns Promise resolving to batch sellers result
     */
    batchGetSellers(domain: string, sellerIds: string[]): Promise<BatchSellersResult>;
    /**
     * Get metadata for a domain's sellers.json
     * @param domain - The domain to fetch metadata for
     * @returns Promise resolving to sellers.json metadata
     */
    getMetadata(domain: string): Promise<SellersJsonMetadata>;
    /**
     * Check if a domain has a sellers.json file
     * @param domain - The domain to check
     * @returns Promise resolving to boolean indicating existence
     */
    hasSellerJson(domain: string): Promise<boolean>;
    /**
     * Get cache information for a domain
     * @param domain - The domain to get cache info for
     * @returns Promise resolving to cache information
     */
    getCacheInfo(domain: string): Promise<CacheInfo>;
}
export interface BatchSellersResult {
    domain: string;
    requested_count: number;
    found_count: number;
    results: SellerResult[];
    metadata: SellersJsonMetadata;
    cache: CacheInfo;
}
export interface SellerResult {
    sellerId: string;
    seller: Seller | null;
    found: boolean;
    source: 'cache' | 'fresh';
    error?: string;
}
export interface Seller {
    seller_id: string;
    name?: string;
    domain?: string;
    seller_type?: 'PUBLISHER' | 'INTERMEDIARY' | 'BOTH';
    is_confidential?: 0 | 1;
    [key: string]: unknown;
}
export interface SellersJsonMetadata {
    version?: string;
    contact_email?: string;
    contact_address?: string;
    seller_count?: number;
    identifiers?: Array<Record<string, unknown>>;
}
export interface CacheInfo {
    is_cached: boolean;
    last_updated?: string;
    status: 'success' | 'error' | 'stale';
    expires_at?: string;
}
export interface ParsedAdsTxtEntryBase {
    line_number: number;
    raw_line: string;
    is_valid: boolean;
    error?: string;
    has_warning?: boolean;
    warning?: string;
    validation_key?: string;
    severity?: Severity;
    warning_params?: WarningParams;
    all_warnings?: WarningDetail[];
    validation_error?: string;
}
export interface ParsedAdsTxtVariable extends ParsedAdsTxtEntryBase {
    variable_type: 'CONTACT' | 'SUBDOMAIN' | 'INVENTORYPARTNERDOMAIN' | 'OWNERDOMAIN' | 'MANAGERDOMAIN';
    value: string;
    is_variable: true;
}
export type ParsedAdsTxtEntry = ParsedAdsTxtRecord | ParsedAdsTxtVariable;
/**
 * Type guard to check if an entry is a record
 */
export declare function isAdsTxtRecord(entry: ParsedAdsTxtEntry): entry is ParsedAdsTxtRecord;
/**
 * Type guard to check if an entry is a variable
 */
export declare function isAdsTxtVariable(entry: ParsedAdsTxtEntry): entry is ParsedAdsTxtVariable;
export interface ParsedAdsTxtRecord extends ParsedAdsTxtEntryBase {
    domain: string;
    account_id: string;
    account_type: string;
    certification_authority_id?: string;
    relationship: 'DIRECT' | 'RESELLER';
    is_variable?: false;
    duplicate_domain?: string;
    validation_results?: CrossCheckValidationResult;
}
/**
 * Parse an ads.txt variable line
 * @param line - The raw line from the file
 * @param lineNumber - The line number in the file (for error reporting)
 * @returns A parsed variable if recognized, null otherwise
 */
export declare function parseAdsTxtVariable(line: string, lineNumber: number): ParsedAdsTxtVariable | null;
/**
 * Parse and validate a line from an Ads.txt file
 * @param line - The raw line from the file
 * @param lineNumber - The line number in the file (for error reporting)
 * @returns A parsed record or variable, or null for comments and empty lines
 */
export declare function parseAdsTxtLine(line: string, lineNumber: number): ParsedAdsTxtEntry | null;
/**
 * Parse and validate a complete Ads.txt file
 * @param content - The full content of the Ads.txt file
 * @param publisherDomain - Optional publisher domain for creating default OWNERDOMAIN if missing
 * @returns Array of parsed records and variables with validation status
 */
export declare function parseAdsTxtContent(content: string, publisherDomain?: string): ParsedAdsTxtEntry[];
/**
 * Logger helper to standardize logging
 */
export type Logger = {
    info: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
};
/**
 * Interface for sellers.json seller record
 */
export interface SellersJsonSellerRecord {
    seller_id: string;
    name?: string;
    domain?: string;
    seller_type?: 'PUBLISHER' | 'INTERMEDIARY' | 'BOTH';
    is_confidential?: 0 | 1;
    [key: string]: unknown;
}
export interface SellersJsonData extends SellersJsonMetadata {
    sellers: SellersJsonSellerRecord[];
    [key: string]: unknown;
}
/**
 * Validation results for cross-checking ads.txt with sellers.json
 */
export interface CrossCheckValidationResult {
    hasSellerJson: boolean;
    directAccountIdInSellersJson: boolean;
    directDomainMatchesSellerJsonEntry: boolean | null;
    directEntryHasPublisherType: boolean | null;
    directSellerIdIsUnique: boolean | null;
    resellerAccountIdInSellersJson: boolean | null;
    resellerDomainMatchesSellerJsonEntry: boolean | null;
    resellerEntryHasIntermediaryType: boolean | null;
    resellerSellerIdIsUnique: boolean | null;
    sellerData?: SellersJsonSellerRecord | null;
    error?: string;
}
/**
 * Optimized cross-check function using SellersJsonProvider
 * This is the new preferred method for performance-critical applications
 */
export declare function crossCheckAdsTxtRecords(publisherDomain: string | undefined, parsedEntries: ParsedAdsTxtEntry[], cachedAdsTxtContent: string | null, sellersJsonProvider: SellersJsonProvider): Promise<ParsedAdsTxtEntry[]>;
/**
 * Legacy cross-check function for backward compatibility
 * @deprecated Use the SellersJsonProvider version for better performance
 */
export declare function crossCheckAdsTxtRecords(publisherDomain: string | undefined, parsedEntries: ParsedAdsTxtEntry[], cachedAdsTxtContent: string | null, getSellersJson: (domain: string) => Promise<SellersJsonData | null>): Promise<ParsedAdsTxtEntry[]>;
/**
 * Check for duplicates in existing ads.txt records
 */
export declare function checkForDuplicates(publisherDomain: string, parsedRecords: ParsedAdsTxtRecord[], // Note: This expects only record entries, not variables
cachedAdsTxtContent: string | null, logger: Logger): Promise<ParsedAdsTxtRecord[]>;
/**
 * Ads.txt Level 1 Optimization
 * Optimizes ads.txt content by:
 * 1. Removing duplicates
 * 2. Standardizing format
 * 3. Preserving comments and variables
 *
 * @param content - The original ads.txt content
 * @param publisherDomain - Optional publisher domain for OWNERDOMAIN default
 * @returns Optimized ads.txt content as a string
 */
export declare function optimizeAdsTxt(content: string, publisherDomain?: string): string;
/**
 * Check if an email address is valid
 * @param email - The email address to validate
 * @returns Boolean indicating if the email is valid
 */
export declare function isValidEmail(email: string): boolean;
