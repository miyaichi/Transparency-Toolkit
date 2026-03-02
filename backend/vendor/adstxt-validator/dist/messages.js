"use strict";
/**
 * Message system for ads-txt-validator
 * Provides internationalized messages and help links for validation results
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultMessageProvider = void 0;
exports.setMessageProvider = setMessageProvider;
exports.configureMessages = configureMessages;
exports.getMessageProvider = getMessageProvider;
exports.createValidationMessage = createValidationMessage;
exports.isSupportedLocale = isSupportedLocale;
exports.getSupportedLocales = getSupportedLocales;
const validation_json_1 = __importDefault(require("./locales/ja/validation.json"));
const validation_json_2 = __importDefault(require("./locales/en/validation.json"));
// Import severity from main index
const index_1 = require("./index");
// Message resources
const messages = {
    ja: validation_json_1.default,
    en: validation_json_2.default,
};
/**
 * Default message provider implementation
 */
class DefaultMessageProvider {
    constructor(defaultLocale = 'ja', config) {
        this.defaultLocale = 'ja';
        this.defaultLocale = config?.defaultLocale || defaultLocale;
        this.baseUrl = config?.baseUrl;
    }
    /**
     * Get raw message data for a validation key
     */
    getMessage(key, locale) {
        const targetLocale = locale || this.defaultLocale;
        const messageBundle = messages[targetLocale] || messages[this.defaultLocale];
        const messageData = messageBundle.validation_errors[key];
        if (!messageData) {
            return null;
        }
        return {
            message: messageData.message,
            description: messageData.description,
            helpUrl: this.formatHelpUrl(messageData.helpUrl),
        };
    }
    /**
     * Format help URL with base URL if configured
     */
    formatHelpUrl(helpUrl) {
        if (!helpUrl) {
            return undefined;
        }
        // If helpUrl is already a full URL (starts with http/https), return as-is
        if (helpUrl.startsWith('http://') || helpUrl.startsWith('https://')) {
            return helpUrl;
        }
        // If baseUrl is configured and helpUrl is relative, combine them
        if (this.baseUrl && helpUrl.startsWith('/')) {
            return `${this.baseUrl.replace(/\/$/, '')}${helpUrl}`;
        }
        // Return helpUrl as-is for other cases
        return helpUrl;
    }
    /**
     * Format a message with placeholders and create a ValidationMessage
     */
    formatMessage(key, placeholders = [], locale) {
        const messageData = this.getMessage(key, locale);
        if (!messageData) {
            return null;
        }
        // Replace placeholders in the message
        const formattedMessage = this.replacePlaceholders(messageData.message, placeholders);
        const formattedDescription = messageData.description
            ? this.replacePlaceholders(messageData.description, placeholders)
            : undefined;
        // Determine severity based on key
        const severity = this.getSeverityFromKey(key);
        return {
            key,
            severity,
            message: formattedMessage,
            description: formattedDescription,
            helpUrl: messageData.helpUrl,
            placeholders,
        };
    }
    /**
     * Replace {{placeholder}} and {{0}}, {{1}} style placeholders
     */
    replacePlaceholders(template, placeholders) {
        let result = template;
        // Replace numbered placeholders like {{0}}, {{1}}
        result = result.replace(/\{\{(\d+)\}\}/g, (match, index) => {
            const placeholderIndex = parseInt(index, 10);
            return placeholders[placeholderIndex] || match;
        });
        // Replace named placeholders
        if (placeholders.length > 0) {
            // Common placeholder names
            const placeholderNames = ['domain', 'accountId', 'sellerDomain', 'accountType'];
            placeholderNames.forEach((name, index) => {
                if (index < placeholders.length) {
                    result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), placeholders[index]);
                }
            });
        }
        return result;
    }
    /**
     * Determine severity from validation key
     */
    getSeverityFromKey(key) {
        // Keys that should be errors
        const errorKeys = [
            'missingFields',
            'invalidFormat',
            'invalidRelationship',
            'invalidDomain',
            'emptyAccountId',
            'emptyFile',
            'invalidCharacters',
            'directAccountIdNotInSellersJson',
            'resellerAccountIdNotInSellersJson',
        ];
        if (errorKeys.includes(key)) {
            return index_1.Severity.ERROR;
        }
        // Keys that should be warnings
        const warningKeys = [
            'noSellersJson',
            'domainMismatch',
            'directNotPublisher',
            'resellerNotIntermediary',
            'sellerIdNotUnique',
        ];
        if (warningKeys.includes(key)) {
            return index_1.Severity.WARNING;
        }
        // Default to info
        return index_1.Severity.INFO;
    }
}
exports.DefaultMessageProvider = DefaultMessageProvider;
/**
 * Global message provider instance
 */
let globalMessageProvider = new DefaultMessageProvider();
/**
 * Set the global message provider
 */
function setMessageProvider(provider) {
    globalMessageProvider = provider;
}
/**
 * Configure the global message provider with baseUrl
 */
function configureMessages(config) {
    globalMessageProvider = new DefaultMessageProvider(config.defaultLocale, config);
}
/**
 * Get the current message provider
 */
function getMessageProvider() {
    return globalMessageProvider;
}
/**
 * Convenience function to create a validation message
 */
function createValidationMessage(key, placeholders = [], locale) {
    return globalMessageProvider.formatMessage(key, placeholders, locale);
}
/**
 * Check if a locale is supported
 */
function isSupportedLocale(locale) {
    return locale in messages;
}
/**
 * Get list of supported locales
 */
function getSupportedLocales() {
    return Object.keys(messages);
}
