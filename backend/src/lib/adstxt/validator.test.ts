import { parseAdsTxtContent, parseAdsTxtLine, VALIDATION_KEYS } from './validator';

describe('Ads.txt Validator', () => {
  describe('parseAdsTxtLine', () => {
    test('should parse a valid DIRECT record with cert ID', () => {
      const line = 'google.com, pub-1234567890, DIRECT, f08c47fec0942fa0';
      const result = parseAdsTxtLine(line, 1);

      expect(result).not.toBeNull();
      if (result && 'domain' in result) {
        // Type guard
        expect(result.domain).toBe('google.com');
        expect(result.account_id).toBe('pub-1234567890');
        expect(result.account_type).toBe('DIRECT');
        expect(result.relationship).toBe('DIRECT');
        expect(result.certification_authority_id).toBe('f08c47fec0942fa0');
        expect(result.is_valid).toBe(true);
      }
    });

    test('should parse a valid RESELLER record without cert ID', () => {
      const line = 'appnexus.com, 12345, RESELLER';
      const result = parseAdsTxtLine(line, 2);

      expect(result).not.toBeNull();
      if (result && 'domain' in result && !('variable_type' in result)) {
        expect(result.domain).toBe('appnexus.com');
        expect(result.account_id).toBe('12345');
        expect(result.relationship).toBe('RESELLER');
        expect(result.certification_authority_id).toBeUndefined();
        expect(result.is_valid).toBe(true);
      }
    });

    test('should ignore case for relationship', () => {
      const line = 'rubiconproject.com, 5678, reseller';
      const result = parseAdsTxtLine(line, 3);

      expect(result).not.toBeNull();
      if (result && 'domain' in result && !('variable_type' in result)) {
        expect(result.relationship).toBe('RESELLER');
        expect(result.is_valid).toBe(true);
      }
    });

    test('should ignore comment lines', () => {
      const line = '# This is a comment';
      const result = parseAdsTxtLine(line, 1);
      expect(result).toBeNull();
    });

    test('should parse valid record with comment at end', () => {
      const line = 'google.com, pub-123, DIRECT # comment';
      const result = parseAdsTxtLine(line, 1);

      expect(result).not.toBeNull();
      if (result && 'domain' in result && !('variable_type' in result)) {
        expect(result.domain).toBe('google.com');
        expect(result.account_id).toBe('pub-123');
        expect(result.is_valid).toBe(true);
      }
    });

    test('should return invalid record for missing fields', () => {
      const line = 'google.com, pub-123';
      const result = parseAdsTxtLine(line, 5);

      expect(result).not.toBeNull();
      expect(result?.is_valid).toBe(false);
      // Testing error property on potentially null object
      expect(result?.error).toBe(VALIDATION_KEYS.MISSING_FIELDS);
    });

    test('should return invalid record for invalid format', () => {
      const line = 'not-a-valid-line';
      const result = parseAdsTxtLine(line, 6);

      expect(result).not.toBeNull();
      expect(result?.is_valid).toBe(false);
      // Testing error property
      expect(result?.error).toBe(VALIDATION_KEYS.MISSING_FIELDS);
    });

    test('should return invalid record for invalid relationship', () => {
      const line = 'google.com, pub-123, INVALID_RELATION';
      const result = parseAdsTxtLine(line, 7);

      expect(result).not.toBeNull();
      expect(result?.is_valid).toBe(false);
      // Testing error property
      expect(result?.error).toBe(VALIDATION_KEYS.INVALID_RELATIONSHIP);
    });

    test('should parse variable line', () => {
      const line = 'CONTACT=admin@example.com';
      const result = parseAdsTxtLine(line, 8);

      expect(result).not.toBeNull();
      if (result && 'variable_type' in result) {
        expect(result.variable_type).toBe('CONTACT');
        expect(result.value).toBe('admin@example.com');
        expect(result.is_variable).toBe(true);
        expect(result.is_valid).toBe(true);
      }
    });
  });

  describe('parseAdsTxtContent', () => {
    test('should parse multiline content correctly', () => {
      const content = `
# Header Comment
google.com, pub-1, DIRECT, id1
appnexus.com, 123, RESELLER

# Another comment
openx.com, 456, RESELLER, id2
CONTACT=email@example.com
        `;

      const validEntries = parseAdsTxtContent(content);
      // 3 records + 1 variable = 4 entries
      expect(validEntries.length).toBe(4);

      const record1 = validEntries.find((e) => 'account_id' in e && e.account_id === 'pub-1');
      expect(record1).toBeDefined();

      const variable = validEntries.find((e) => 'variable_type' in e && e.variable_type === 'CONTACT');
      expect(variable).toBeDefined();
    });

    test('should return error entry for empty content', () => {
      const result = parseAdsTxtContent('');
      expect(result.length).toBe(1);
      expect(result[0].is_valid).toBe(false);
      // Testing error property
      expect(result[0].error).toBe(VALIDATION_KEYS.EMPTY_FILE);
    });

    test('should auto-add OWNERDOMAIN if publisherDomain provided but missing in file', () => {
      const content = 'google.com, pub-1, DIRECT';
      const result = parseAdsTxtContent(content, 'example.com');

      const ownerDomain = result.find((e) => 'variable_type' in e && e.variable_type === 'OWNERDOMAIN');
      expect(ownerDomain).toBeDefined();
      // Testing value property
      expect((ownerDomain as any).value).toBe('example.com');
    });

    test('should NOT auto-add OWNERDOMAIN if already present', () => {
      const content = `
google.com, pub-1, DIRECT
OWNERDOMAIN=existing.com
        `;
      const result = parseAdsTxtContent(content, 'example.com');

      const ownerDomains = result.filter((e) => 'variable_type' in e && e.variable_type === 'OWNERDOMAIN');
      expect(ownerDomains.length).toBe(1);
      // Testing value property
      expect((ownerDomains[0] as any).value).toBe('existing.com');
    });
  });
});
