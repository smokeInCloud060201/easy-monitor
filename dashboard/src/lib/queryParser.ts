/**
 * Structured query parser for the Logs search bar.
 *
 * Supports syntax like:
 *   service:order-service AND message:"connection timeout"
 *   level:ERROR service:payment-service timeout
 *   host:worker-1 source:stdout
 *
 * Bare text (no field qualifier) is treated as a keyword search on the message column.
 */

export interface ParsedQuery {
  service?: string;
  level?: string;
  pod_id?: string;
  trace_id?: string;
  host?: string;
  source?: string;
  namespace?: string;
  node_name?: string;
  keyword?: string; // remaining bare text → message ILIKE
}

const SUPPORTED_FIELDS: Set<string> = new Set([
  'service', 'level', 'pod_id', 'trace_id',
  'host', 'source', 'namespace', 'node_name', 'message',
]);

/**
 * Tokenize input respecting quoted strings.
 * e.g. `service:order-service AND message:"hello world"` →
 *   ['service:order-service', 'AND', 'message:"hello world"']
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    // Skip whitespace
    while (i < len && input[i] === ' ') i++;
    if (i >= len) break;

    let token = '';

    // Check if this token contains a field:value pattern with possible quotes
    while (i < len && input[i] !== ' ') {
      if (input[i] === '"') {
        // Consume entire quoted section
        i++; // skip opening quote
        while (i < len && input[i] !== '"') {
          token += input[i];
          i++;
        }
        if (i < len) i++; // skip closing quote
      } else {
        token += input[i];
        i++;
      }
    }

    if (token.length > 0) {
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Parse a log search query string into structured filter fields.
 *
 * Examples:
 *   parseLogQuery('service:order-service') → { service: 'order-service' }
 *   parseLogQuery('message:"test"') → { keyword: 'test' }
 *   parseLogQuery('service:order-service AND message:"test"') → { service: 'order-service', keyword: 'test' }
 *   parseLogQuery('hello world') → { keyword: 'hello world' }
 *   parseLogQuery('level:ERROR service:payment-service timeout') → { level: 'ERROR', service: 'payment-service', keyword: 'timeout' }
 */
export function parseLogQuery(input: string): ParsedQuery {
  const result: ParsedQuery = {};
  const keywordParts: string[] = [];

  if (!input || !input.trim()) {
    return result;
  }

  const tokens = tokenize(input.trim());

  for (const token of tokens) {
    // Skip boolean operators
    if (token === 'AND' || token === 'OR') continue;

    // Check for field:value pattern
    const colonIdx = token.indexOf(':');
    if (colonIdx > 0) {
      const field = token.substring(0, colonIdx).toLowerCase();
      const value = token.substring(colonIdx + 1);

      if (SUPPORTED_FIELDS.has(field)) {
        if (field === 'message') {
          // message:value → keyword search
          keywordParts.push(value);
        } else {
          // Known field → set in result
          (result as Record<string, string>)[field] = value;
        }
        continue;
      }
    }

    // Bare text or unknown field → keyword
    keywordParts.push(token);
  }

  if (keywordParts.length > 0) {
    result.keyword = keywordParts.join(' ');
  }

  return result;
}
