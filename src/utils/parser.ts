import { JsonParseError } from "@/error";

/**
 * Handles: ```json ... ``` and ``` ... ```
 */
function stripMarkdownFences(raw: string): string {
  // Remove opening fence with optional language tag
  let result = raw.replace(/^```(?:json|typescript|js|javascript)?\s*/i, "");
  // Remove closing fence
  result = result.replace(/\s*```\s*$/, "");
  return result.trim();
}

function extractFirstJsonBlock(raw: string): string {
  const objectStart = raw.indexOf("{");
  const arrayStart = raw.indexOf("[");

  // Determine which comes first
  let startIndex: number;
  let openChar: string;
  let closeChar: string;

  if (objectStart === -1 && arrayStart === -1) {
    return raw; // No JSON structure found, return as-is for next stage
  } else if (objectStart === -1) {
    startIndex = arrayStart;
    openChar = "[";
    closeChar = "]";
  } else if (arrayStart === -1) {
    startIndex = objectStart;
    openChar = "{";
    closeChar = "}";
  } else {
    // Both exist so take whichever comes first
    startIndex = Math.min(objectStart, arrayStart);
    openChar = raw[startIndex] === "{" ? "{" : "[";
    closeChar = openChar === "{" ? "}" : "]";
  }

  // Walk the string tracking brace depth to find the matching close
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < raw.length; i++) {
    const char = raw[i]!;

    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === openChar) depth++;
    if (char === closeChar) depth--;

    if (depth === 0) {
      return raw.slice(startIndex, i + 1);
    }
  }

  // Unbalanced braces, return from start to end and let JSON.parse complain
  return raw.slice(startIndex);
}

/**
 * Fix common JSON syntax errors that small models emit.
 */
function sanitizeJsonSyntax(raw: string): string {
  let result = raw;

  // 1. Replace single-quoted keys/values with double quotes
  //    e.g. {'key': 'value'} → {"key": "value"}
  //    Only replaces quotes not already inside double-quoted strings
  result = result.replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":');
  result = result.replace(/:\s*'([^']*)'/g, ': "$1"');

  // 2. Remove trailing commas before } or ]
  //    e.g. {"a": 1,} → {"a": 1}
  result = result.replace(/,\s*([\]}])/g, "$1");

  // 3. Strip JavaScript-style comments (// and /* */)
  result = result.replace(/\/\/.*$/gm, "");
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");

  // 4. Remove control characters that break JSON.parse
  //    (except standard whitespace: tab, newline, carriage return)
  // eslint-disable-next-line no-control-regex
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  // 5. Strip function-call wrappers e.g. get_price({"ticker": "X"})
  //    The model sometimes wraps JSON in a phantom function call
  result = result.replace(/^\w[\w.]*\s*\(/, "").replace(/\)\s*$/, "");

  return result.trim();
}

export function parseModelJson<T = unknown>(raw: string): T {
  const original = raw;

  // Direct parse — fast path for well-behaved models
  try {
    return JSON.parse(raw) as T;
  } catch {}

  // Strip markdown fences
  let cleaned = stripMarkdownFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {}

  // Extract first JSON block (handles preamble)
  cleaned = extractFirstJsonBlock(cleaned);
  try {
    return JSON.parse(cleaned) as T;
  } catch {}

  // Sanitize syntax errors
  cleaned = sanitizeJsonSyntax(cleaned);
  try {
    return JSON.parse(cleaned) as T;
  } catch {}

  // Extract + sanitize combined (belt-and-suspenders)
  const lastAttempt = sanitizeJsonSyntax(extractFirstJsonBlock(cleaned));
  try {
    return JSON.parse(lastAttempt) as T;
  } catch (finalError) {
    throw new JsonParseError(
      `Failed to parse model JSON after all sanitization stages.\n` +
        `Final error: ${(finalError as Error).message}\n` +
        `Original input: ${original.slice(0, 200)}`,
      original,
      "sanitize+extract",
    );
  }
}

export function parseToolArguments(
  raw: string,
  toolName: string,
): Record<string, unknown> {
  try {
    return parseModelJson<Record<string, unknown>>(raw);
  } catch (err) {
    if (err instanceof JsonParseError) {
      throw new JsonParseError(
        `Tool '${toolName}' returned unparseable arguments: ${err.message}`,
        err.raw,
        err.stage,
      );
    }
    throw err;
  }
}
