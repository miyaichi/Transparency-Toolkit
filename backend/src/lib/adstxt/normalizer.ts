/**
 * Normalizes a variable directive line (e.g., OWNERDOMAIN, MANAGERDOMAIN)
 */
export function normalizeVariableLine(line: string): string {
  if (!line.includes('=')) return line;

  const [key, ...rest] = line.split('=');
  const value = rest.join('='); // Rejoin in case value contains '='

  // Uppercase the key, keep value as is but trim
  return `${key.trim().toUpperCase()}=${value.trim()}`;
}

/**
 * Normalizes a standard ads.txt data line
 * Format: <Field #1>, <Field #2>, <Field #3>, <Field #4>
 */
export function normalizeDataLine(line: string): string {
  // Handle inline comments
  let content = line;
  let comment = '';

  if (line.includes('#')) {
    const parts = line.split('#');
    content = parts[0];
    comment = '#' + parts.slice(1).join('#');
  }

  const parts = content.split(',').map((s) => s.trim());

  // If not a valid data line (less than 3 fields typically, but we normalize what we can)
  if (parts.length < 2) {
    // If it's just garbage but not empty, just return trimmed
    return line.trim();
  }

  // Field #1: Domain name (canonically lowercase)
  if (parts[0]) {
    parts[0] = parts[0].toLowerCase();
  }

  // Field #2: Account ID (keep case as is, strict equality required)

  // Field #3: Account Type (canonically uppercase)
  if (parts.length > 2 && parts[2]) {
    const type = parts[2].toUpperCase();
    if (type === 'DIRECT' || type === 'RESELLER') {
      parts[2] = type;
    } else {
      // If it's something else, we try to uppercase it anyway if it looks like a type
      parts[2] = type;
    }
  }

  // Field #4: Certification Authority ID (keep case usually, but lowercase is common convention so we leave it as is for now to avoid breaking ID matches)

  // Reconstruct line
  let normalized = parts.join(', ');

  // Append comment back if it existed
  if (comment) {
    if (normalized.length > 0) {
      normalized += ' ' + comment;
    } else {
      normalized = comment;
    }
  }

  return normalized;
}

/**
 * Normalizes the entire content of an ads.txt file
 */
export function normalizeAdsTxt(content: string): string {
  let lines = content.split(/\r?\n/);
  const normalizedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Preserve empty lines (will be collapsed later if needed)
    if (!trimmed) {
      normalizedLines.push('');
      continue;
    }

    // Comment-only lines
    if (trimmed.startsWith('#')) {
      normalizedLines.push(trimmed);
      continue;
    }

    // Variable Directives
    if (
      trimmed.toUpperCase().includes('OWNERDOMAIN=') ||
      trimmed.toUpperCase().includes('MANAGERDOMAIN=') ||
      trimmed.toUpperCase().includes('CONTACT=') ||
      trimmed.toUpperCase().includes('SUBDOMAIN=')
    ) {
      normalizedLines.push(normalizeVariableLine(trimmed));
      continue;
    }

    // Data Lines
    if (trimmed.includes(',')) {
      normalizedLines.push(normalizeDataLine(trimmed));
    } else {
      // Fallback for unknown lines
      normalizedLines.push(trimmed);
    }
  }

  // Final cleanup:
  // 1. Join with LF
  // 2. Collapse multiple empty lines (max 1 empty line)
  // 3. Trim trailing file whitespace
  return (
    normalizedLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n') // Collapse 3+ newlines to 2
      .trim() + '\n'
  ); // Ensure single trailing newline
}

/**
 * Diagnostics for invalid lines
 * Returns a specific error key if a known fixable issue is detected
 */
export function diagnoseLine(line: string): string | null {
  const content = line.split('#')[0].trim();
  if (!content) return null;

  // 1. Check for Full-width characters (e.g., １２３, ａｂｃ, ，)
  // Range includes Fullwidth forms (FF00-FFEF) and CJK symbols that might be mistaken for punctuation
  // Specifically: Fullwidth Comma (FF0C), Ideographic Comma (3001), Fullwidth Spaces (3000)
  if (/[\uFF01-\uFF5E\u3000\u3001-\u3002\uFF0C]/.test(content)) {
    return 'containsFullWidthChar';
  }

  // 2. Check for alternative separators (semicolon, tabs, pipe) instead of comma
  // But only if comma is missing
  if (!content.includes(',')) {
    if (content.includes(';') || content.includes('\t') || content.includes('|')) {
      return 'invalidSeparator';
    }
  }

  // 3. Check for invalid case in Relationship field (when otherwise structure looks okay)
  const parts = content.split(',').map((s) => s.trim());
  if (parts.length >= 3) {
    const type = parts[2];
    const upper = type.toUpperCase();
    if ((upper === 'DIRECT' || upper === 'RESELLER') && type !== upper) {
      return 'invalidCase'; // Relationship case error
    }
  }

  return null;
}
