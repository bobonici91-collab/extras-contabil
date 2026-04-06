import type { BankParser, ParseResult, ParsedTransaction, ValidationMessage } from './types';
import { parseAmount } from './base-csv-parser';

// MT940 tag patterns
const TAG_PATTERNS = {
  transactionRef: /^:20:(.+)$/,
  accountId: /^:25:(.+)$/,
  statementNumber: /^:28C:(.+)$/,
  openingBalance: /^:60[FM]:([CD])(\d{6})([A-Z]{3})([\d,]+)$/,
  statementLine: /^:61:(\d{6})(\d{4})?([CD]R?)([\d,]+)([A-Z][A-Z0-9]{3})(.*)$/,
  information: /^:86:(.+)$/,
  closingBalance: /^:62[FM]:([CD])(\d{6})([A-Z]{3})([\d,]+)$/,
  availableBalance: /^:64:([CD])(\d{6})([A-Z]{3})([\d,]+)$/,
};

function parseMT940Date(dateStr: string): Date | null {
  if (dateStr.length !== 6) return null;
  const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
  const month = parseInt(dateStr.substring(2, 4), 10);
  const day = parseInt(dateStr.substring(4, 6), 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

function parseMT940Amount(amountStr: string): number {
  return parseAmount(amountStr, ',', '.');
}

export class MT940Parser implements BankParser {
  bankId = 'mt940';
  bankName = 'Format MT940 (SWIFT)';
  supportedFormats = ['mt940', 'sta', 'txt'];

  detect(content: string, filename: string): number {
    let confidence = 0;

    // Check for MT940 specific tags
    if (content.includes(':20:')) confidence += 15;
    if (content.includes(':25:')) confidence += 15;
    if (content.includes(':60F:') || content.includes(':60M:')) confidence += 20;
    if (content.includes(':61:')) confidence += 20;
    if (content.includes(':62F:') || content.includes(':62M:')) confidence += 20;

    // Check file extension
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'sta' || ext === 'mt940') confidence += 15;

    return Math.min(confidence, 100);
  }

  async parse(content: string): Promise<ParseResult> {
    const warnings: ValidationMessage[] = [];
    const errors: ValidationMessage[] = [];
    const transactions: ParsedTransaction[] = [];

    // Normalize line endings and join continuation lines
    const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    // Join lines that are continuations (don't start with :)
    const lines: string[] = [];
    for (const line of rawLines) {
      if (line.startsWith(':') || lines.length === 0) {
        lines.push(line);
      } else if (lines.length > 0 && line.trim()) {
        lines[lines.length - 1] += ' ' + line.trim();
      }
    }

    let accountId = '';
    let currency = 'RON';
    let openingBalance: number | null = null;
    let closingBalance: number | null = null;
    let currentTransaction: Partial<ParsedTransaction> | null = null;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Account identification
      const accountMatch = trimmed.match(TAG_PATTERNS.accountId);
      if (accountMatch) {
        accountId = accountMatch[1].trim();
        // Extract IBAN if present
        const ibanMatch = accountId.match(/RO\d{2}[A-Z]{4}[A-Z0-9]{16}/);
        if (ibanMatch) accountId = ibanMatch[0];
        continue;
      }

      // Opening balance
      const openMatch = trimmed.match(TAG_PATTERNS.openingBalance);
      if (openMatch) {
        const dcIndicator = openMatch[1];
        currency = openMatch[3];
        const amount = parseMT940Amount(openMatch[4]);
        openingBalance = dcIndicator === 'D' ? -amount : amount;
        continue;
      }

      // Statement line (transaction)
      const txMatch = trimmed.match(TAG_PATTERNS.statementLine);
      if (txMatch) {
        // Save previous transaction
        if (currentTransaction && currentTransaction.date) {
          transactions.push(currentTransaction as ParsedTransaction);
        }

        const date = parseMT940Date(txMatch[1]);
        const dcIndicator = txMatch[3];
        const amount = parseMT940Amount(txMatch[4]);
        const reference = txMatch[6]?.trim() || '';

        const isDebit = dcIndicator === 'D' || dcIndicator === 'DR';

        currentTransaction = {
          date: date || new Date(),
          description: '',
          debit: isDebit ? amount : 0,
          credit: isDebit ? 0 : amount,
          currency,
          reference,
          counterparty: '',
          iban: '',
          balance: null,
          rawLine: trimmed,
          lineNumber,
        };
        continue;
      }

      // Information to account owner (transaction details)
      const infoMatch = trimmed.match(TAG_PATTERNS.information);
      if (infoMatch && currentTransaction) {
        const info = infoMatch[1].trim();

        // Parse SWIFT sub-fields (^20=description, ^30=bank, ^31=IBAN, ^32/^33=counterparty)
        const subFields = info.replace(/^000/, '').split('^').filter(Boolean);
        let description = '';
        let counterparty = '';

        for (const field of subFields) {
          const code = field.substring(0, 2);
          const value = field.substring(2).trim();

          if (code === '20' || code === '21' || code === '22' || code === '23') {
            description += value + ' ';
          } else if (code === '31') {
            // IBAN
            const ibanClean = value.replace(/\s/g, '');
            const ibanMatch = ibanClean.match(/RO\d{2}[A-Z]{4}[A-Z0-9]{16}/);
            if (ibanMatch && !currentTransaction.iban) {
              currentTransaction.iban = ibanMatch[0];
            }
          } else if (code === '32' || code === '33') {
            counterparty += value + ' ';
          }
        }

        if (description.trim()) {
          currentTransaction.description = currentTransaction.description
            ? currentTransaction.description + ' ' + description.trim()
            : description.trim();
        } else {
          // Fallback: use raw info if no sub-fields parsed
          currentTransaction.description = currentTransaction.description
            ? currentTransaction.description + ' ' + info
            : info;
        }

        if (counterparty.trim() && !currentTransaction.counterparty) {
          currentTransaction.counterparty = counterparty.trim();
        }

        // Fallback IBAN extraction from raw text
        if (!currentTransaction.iban) {
          const ibanInDesc = info.match(/RO\d{2}[A-Z]{4}[A-Z0-9]{16}/);
          if (ibanInDesc) {
            currentTransaction.iban = ibanInDesc[0];
          }
        }
        continue;
      }

      // Closing balance
      const closeMatch = trimmed.match(TAG_PATTERNS.closingBalance);
      if (closeMatch) {
        // Save last transaction
        if (currentTransaction && currentTransaction.date) {
          transactions.push(currentTransaction as ParsedTransaction);
          currentTransaction = null;
        }

        const dcIndicator = closeMatch[1];
        const amount = parseMT940Amount(closeMatch[4]);
        closingBalance = dcIndicator === 'D' ? -amount : amount;
        continue;
      }
    }

    // Save final pending transaction
    if (currentTransaction && currentTransaction.date) {
      transactions.push(currentTransaction as ParsedTransaction);
    }

    if (transactions.length === 0) {
      errors.push({
        code: 'NO_TRANSACTIONS',
        message: 'Nu s-au gasit tranzactii in fisierul MT940.',
        severity: 'critical',
      });
    }

    const totalDebit = transactions.reduce((s, t) => s + t.debit, 0);
    const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);
    const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());

    return {
      success: errors.filter(e => e.severity === 'critical').length === 0,
      transactions,
      warnings,
      errors,
      metadata: {
        bank: 'mt940',
        bankName: 'MT940 (SWIFT)',
        format: 'mt940',
        accountIban: accountId,
        currency,
        dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
        openingBalance,
        closingBalance,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        transactionCount: transactions.length,
        encoding: 'ascii',
      },
      confidence: transactions.length > 0 ? 85 : 0,
    };
  }
}
