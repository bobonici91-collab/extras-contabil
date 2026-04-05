import type { ParseResult, ValidationLayerResult, ValidationMessage } from '../parsers/types';

// Common mojibake patterns that indicate encoding issues
const MOJIBAKE_PATTERNS = [
  /Ã¢|Ã®|Ã£|È|È|Å|Å£|Ä|Ä/,   // UTF-8 decoded as Windows-1252
  /\ufffd/,                             // Unicode replacement character
  /â€™|â€"|â€œ|â€/,               // Smart quotes mojibake
  /Ã¡|Ã©|Ã¨|Ã²|Ã¹/,              // Accented chars mojibake
];

// Romanian-specific characters that should be present in valid Romanian text
const ROMANIAN_CHARS = /[ăâîșțĂÂÎȘȚ]/;

// Old-style Romanian characters (T-cedilla instead of T-comma) - acceptable but worth noting
const OLD_ROMANIAN_CHARS = /[şţŞŢ]/;

export function validateEncoding(result: ParseResult): ValidationLayerResult {
  const messages: ValidationMessage[] = [];

  let hasMojibake = false;
  let hasRomanianChars = false;
  let hasOldRomanianChars = false;

  for (const tx of result.transactions) {
    const textToCheck = `${tx.description} ${tx.counterparty} ${tx.reference}`;

    // Check for mojibake
    for (const pattern of MOJIBAKE_PATTERNS) {
      if (pattern.test(textToCheck)) {
        hasMojibake = true;
        messages.push({
          code: 'MOJIBAKE_DETECTED',
          message: `Randul ${tx.lineNumber}: caractere corupte detectate in "${textToCheck.substring(0, 60)}...". Posibila problema de codificare (encoding).`,
          lineNumber: tx.lineNumber,
          field: 'description',
          severity: 'error',
        });
        break; // One warning per transaction is enough
      }
    }

    // Track presence of Romanian characters
    if (ROMANIAN_CHARS.test(textToCheck)) hasRomanianChars = true;
    if (OLD_ROMANIAN_CHARS.test(textToCheck)) hasOldRomanianChars = true;
  }

  // If we have lots of text but no Romanian characters, might be encoding issue
  const totalTextLength = result.transactions.reduce(
    (sum, tx) => sum + (tx.description?.length || 0), 0
  );
  if (totalTextLength > 200 && !hasRomanianChars && !hasMojibake) {
    messages.push({
      code: 'NO_ROMANIAN_CHARS',
      message: 'Nu s-au detectat caractere romanesti (ă, â, î, ș, ț) in descrierile tranzactiilor. Daca extrasul este in romana, verificati codificarea fisierului.',
      severity: 'info',
    });
  }

  // Note old-style Romanian chars
  if (hasOldRomanianChars) {
    messages.push({
      code: 'OLD_ROMANIAN_CHARS',
      message: 'Fisierul contine caractere romanesti in format vechi (ş/ţ cu sedila in loc de ș/ț cu virgula). Acestea vor fi convertite automat la export.',
      severity: 'info',
    });
  }

  // Check encoding matches expected
  if (result.metadata.encoding === 'windows-1250' && hasMojibake) {
    messages.push({
      code: 'ENCODING_MISMATCH',
      message: `Codificarea detectata (${result.metadata.encoding}) pare sa nu fie corecta. Caractere corupte au fost gasite in fisier.`,
      severity: 'error',
    });
  }

  const hasBlocking = messages.some(m => m.severity === 'critical');
  const errorCount = messages.filter(m => m.severity === 'error').length;

  let score = 100;
  score -= errorCount * 15;
  if (hasMojibake) score -= 30;

  return {
    layer: 'encoding',
    passed: !hasMojibake,
    hasBlockingErrors: false, // Encoding issues are fixable, not blocking
    messages,
    score: Math.max(0, Math.min(100, score)),
  };
}
