/**
 * Message system for ads-txt-validator
 * Provides internationalized messages and help links for validation results
 */
export interface ValidationMessage {
    key: string;
    severity: Severity;
    message: string;
    description?: string;
    helpUrl?: string;
    placeholders: string[];
}
export interface MessageData {
    message: string;
    description?: string;
    helpUrl?: string;
}
export interface MessageProvider {
    getMessage(key: string, locale?: string): MessageData | null;
    formatMessage(key: string, placeholders: string[], locale?: string): ValidationMessage | null;
}
import { Severity } from './index';
declare const messages: {
    readonly ja: {
        validation_errors: {
            missingFields: {
                message: string;
                description: string;
                helpUrl: string;
            };
            invalidFormat: {
                message: string;
                description: string;
                helpUrl: string;
            };
            invalidRelationship: {
                message: string;
                description: string;
                helpUrl: string;
            };
            invalidDomain: {
                message: string;
                description: string;
                helpUrl: string;
            };
            emptyAccountId: {
                message: string;
                description: string;
                helpUrl: string;
            };
            emptyFile: {
                message: string;
                description: string;
                helpUrl: string;
            };
            invalidCharacters: {
                message: string;
                description: string;
                helpUrl: string;
            };
            noSellersJson: {
                message: string;
                description: string;
                helpUrl: string;
            };
            directAccountIdNotInSellersJson: {
                message: string;
                description: string;
                helpUrl: string;
            };
            resellerAccountIdNotInSellersJson: {
                message: string;
                description: string;
                helpUrl: string;
            };
            domainMismatch: {
                message: string;
                description: string;
                helpUrl: string;
            };
            directNotPublisher: {
                message: string;
                description: string;
                helpUrl: string;
            };
            sellerIdNotUnique: {
                message: string;
                description: string;
                helpUrl: string;
            };
            resellerNotIntermediary: {
                message: string;
                description: string;
                helpUrl: string;
            };
            implimentedEntry: {
                message: string;
                description: string;
                helpUrl: string;
            };
            noValidRecords: {
                message: string;
                description: string;
                helpUrl: string;
            };
            parsingError: {
                message: string;
                description: string;
                helpUrl: string;
            };
        };
    };
    readonly en: {
        validation_errors: {
            missingFields: {
                message: string;
                description: string;
                helpUrl: string;
            };
            invalidFormat: {
                message: string;
                description: string;
                helpUrl: string;
            };
            invalidRelationship: {
                message: string;
                description: string;
                helpUrl: string;
            };
            invalidDomain: {
                message: string;
                description: string;
                helpUrl: string;
            };
            emptyAccountId: {
                message: string;
                description: string;
                helpUrl: string;
            };
            emptyFile: {
                message: string;
                description: string;
                helpUrl: string;
            };
            invalidCharacters: {
                message: string;
                description: string;
                helpUrl: string;
            };
            noSellersJson: {
                message: string;
                description: string;
                helpUrl: string;
            };
            directAccountIdNotInSellersJson: {
                message: string;
                description: string;
                helpUrl: string;
            };
            resellerAccountIdNotInSellersJson: {
                message: string;
                description: string;
                helpUrl: string;
            };
            domainMismatch: {
                message: string;
                description: string;
                helpUrl: string;
            };
            directNotPublisher: {
                message: string;
                description: string;
                helpUrl: string;
            };
            sellerIdNotUnique: {
                message: string;
                description: string;
                helpUrl: string;
            };
            resellerNotIntermediary: {
                message: string;
                description: string;
                helpUrl: string;
            };
            implimentedEntry: {
                message: string;
                description: string;
                helpUrl: string;
            };
            noValidRecords: {
                message: string;
                description: string;
                helpUrl: string;
            };
            parsingError: {
                message: string;
                description: string;
                helpUrl: string;
            };
        };
    };
};
export type SupportedLocale = keyof typeof messages;
/**
 * Configuration for message provider
 */
export interface MessageConfig {
    defaultLocale?: SupportedLocale;
    baseUrl?: string;
}
/**
 * Default message provider implementation
 */
export declare class DefaultMessageProvider implements MessageProvider {
    private defaultLocale;
    private baseUrl?;
    constructor(defaultLocale?: SupportedLocale, config?: MessageConfig);
    /**
     * Get raw message data for a validation key
     */
    getMessage(key: string, locale?: string): MessageData | null;
    /**
     * Format help URL with base URL if configured
     */
    private formatHelpUrl;
    /**
     * Format a message with placeholders and create a ValidationMessage
     */
    formatMessage(key: string, placeholders?: string[], locale?: string): ValidationMessage | null;
    /**
     * Replace {{placeholder}} and {{0}}, {{1}} style placeholders
     */
    private replacePlaceholders;
    /**
     * Determine severity from validation key
     */
    private getSeverityFromKey;
}
/**
 * Set the global message provider
 */
export declare function setMessageProvider(provider: MessageProvider): void;
/**
 * Configure the global message provider with baseUrl
 */
export declare function configureMessages(config: MessageConfig): void;
/**
 * Get the current message provider
 */
export declare function getMessageProvider(): MessageProvider;
/**
 * Convenience function to create a validation message
 */
export declare function createValidationMessage(key: string, placeholders?: string[], locale?: string): ValidationMessage | null;
/**
 * Check if a locale is supported
 */
export declare function isSupportedLocale(locale: string): locale is SupportedLocale;
/**
 * Get list of supported locales
 */
export declare function getSupportedLocales(): SupportedLocale[];
export {};
