import type { ParseResult, ValidationLayerResult, ValidationMessage } from '../parsers/types';

// Romanian bank IBAN prefixes (4-letter bank code after RO + 2 check digits)
const BANK_IBAN_CODES: Record<string, string[]> = {
  bcr: ['RNCB'],
  brd: ['BRDE'],
  bt: ['BTRL'],
  ing: ['INGB'],
  raiffeisen: ['RZBR'],
  cec: ['CECE'],
  unicredit: ['BACX'],
  otp: ['OTPV'],
  alpha: ['BUCU'],
};

// Validate IBAN checksum using ISO 13616 (mod 97)
function validateIBANChecksum(iban: string): boolean {
  if (!iban || iban.length < 5) return false;

  // Move first 4 chars to end
  const rearranged = iban.substring(4) + iban.substring(0, 4);

  // Replace letters with numbers (A=10, B=11, ... Z=35)
  let numericStr = '';
  for (const char of rearranged) {
    if (char >= '0' && char <= '9') {
      numericStr += char;
    } else {
      numericStr += (char.charCodeAt(0) - 'A'.charCodeAt(0) + 10).toString();
    }
  }

  // Calculate mod 97 using chunk method (to avoid BigInt issues)
  let remainder = 0;
  for (let i = 0; i < numericStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numericStr[i])) % 97;
  }

  return remainder === 1;
}

// Validate Romanian IBAN format
function isValidRomanianIBAN(iban: string): { valid: boolean; bankCode: string } {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();

  // RO + 2 check digits + 4 letter bank code + 16 alphanumeric
  const match = cleaned.match(/^RO(\d{2})([A-Z]{4})([A-Z0-9]{16})$/);
  if (!match) return { valid: false, bankCode: '' };

  const bankCode = match[2];
  const checksumValid = validateIBANChecksum(cleaned);

  return { valid: checksumValid, bankCode };
}

export function validateCrossCheck(result: ParseResult): ValidationLayerResult {
  const messages: ValidationMessage[] = [];
  const { metadata, transactions } = result;

  // Validate account IBAN
  if (metadata.accountIban) {
    const ibanResult = isValidRomanianIBAN(metadata.accountIban);

    if (!ibanResult.valid) {
      messages.push({
        code: 'INVALID_IBAN',
        message: `IBAN-ul contului (${metadata.accountIban}) nu este valid. Cifra de control nu se verifica.`,
        severity: 'error',
      });
    }

    // Cross-check bank code in IBAN with selected bank
    if (ibanResult.bankCode && metadata.bank !== 'mt940' && metadata.bank !== 'camt053') {
      const expectedCodes = BANK_IBAN_CODES[metadata.bank];
      if (expectedCodes && !expectedCodes.includes(ibanResult.bankCode)) {
        messages.push({
          code: 'IBAN_BANK_MISMATCH',
          message: `IBAN-ul contului contine codul bancii "${ibanResult.bankCode}", dar formatul selectat este "${metadata.bankName}". Verificati ca ati selectat banca corecta.`,
          severity: 'error',
        });
      } else if (expectedCodes && expectedCodes.includes(ibanResult.bankCode)) {
        messages.push({
          code: 'IBAN_BANK_MATCH',
          message: `Codul bancii din IBAN (${ibanResult.bankCode}) corespunde cu banca selectata (${metadata.bankName}).`,
          severity: 'info',
        });
      }
    }
  }

  // Validate counterparty IBANs in transactions
  let invalidCounterpartyIbans = 0;
  for (const tx of transactions) {
    if (tx.iban && tx.iban.startsWith('RO')) {
      const ibanResult = isValidRomanianIBAN(tx.iban);
      if (!ibanResult.valid) {
        invalidCounterpartyIbans++;
        if (invalidCounterpartyIbans <= 3) {
          messages.push({
            code: 'INVALID_COUNTERPARTY_IBAN',
            message: `Randul ${tx.lineNumber}: IBAN-ul contrapartidei (${tx.iban}) nu este valid.`,
            lineNumber: tx.lineNumber,
            severity: 'warning',
          });
        }
      }
    }
  }

  if (invalidCounterpartyIbans > 3) {
    messages.push({
      code: 'MANY_INVALID_IBANS',
      message: `Inca ${invalidCounterpartyIbans - 3} IBAN-uri invalide ale contrapartidelor neafisate.`,
      severity: 'warning',
    });
  }

  // Check currency consistency
  const currencies = new Set(transactions.map(tx => tx.currency));
  if (currencies.size > 1) {
    messages.push({
      code: 'MULTI_CURRENCY',
      message: `Extrasul contine tranzactii in mai multe monede: ${Array.from(currencies).join(', ')}. Exportul SAGA va include doar moneda principala.`,
      severity: 'warning',
    });
  }

  // Check if currency matches account currency
  if (metadata.currency && currencies.size === 1) {
    const txCurrency = Array.from(currencies)[0];
    if (txCurrency !== metadata.currency) {
      messages.push({
        code: 'CURRENCY_MISMATCH',
        message: `Moneda tranzactiilor (${txCurrency}) difera de moneda contului (${metadata.currency}).`,
        severity: 'warning',
      });
    }
  }

  const hasBlocking = messages.some(m => m.severity === 'critical');
  const errorCount = messages.filter(m => m.severity === 'error').length;
  const warningCount = messages.filter(m => m.severity === 'warning').length;

  let score = 100;
  score -= errorCount * 15;
  score -= warningCount * 3;

  return {
    layer: 'cross-check',
    passed: !hasBlocking,
    hasBlockingErrors: false,
    messages,
    score: Math.max(0, Math.min(100, score)),
  };
}
