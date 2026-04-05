import type { BankParser, ParseResult, ParsedTransaction, ParseMetadata, ValidationMessage } from './types';

export interface ColumnMapping {
  date: number;
  description: number;
  debit: number;
  credit: number;
  reference?: number;
  counterparty?: number;
  iban?: number;
  balance?: number;
  // Some banks use single amount column with sign
  amount?: number;
  // Some banks have debit/credit indicator column
  dcIndicator?: number;
}

export interface CSVParserConfig {
  bankId: string;
  bankName: string;
  delimiter: string;
  dateFormats: string[];          // e.g. ['DD.MM.YYYY', 'DD/MM/YYYY']
  headerPatterns: RegExp[];       // Patterns to identify bank format
  columnMapping: ColumnMapping;
  skipRows: number;               // Header rows to skip
  encoding: string;
  decimalSeparator: ',' | '.';
  thousandsSeparator: '.' | ',' | ' ' | '';
  hasHeaderRow: boolean;
  // Amount handling
  amountInSingleColumn: boolean;  // true if debit/credit in same column
  debitIsNegative: boolean;       // true if debits are negative in single column
}

// Parse Romanian date formats
export function parseDate(dateStr: string, formats: string[]): Date | null {
  const cleaned = dateStr.trim();

  for (const format of formats) {
    if (format === 'DD.MM.YYYY' || format === 'DD/MM/YYYY') {
      const sep = format.includes('.') ? '.' : '/';
      const parts = cleaned.split(sep);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
          return new Date(year, month - 1, day);
        }
      }
    }
    if (format === 'YYYY-MM-DD') {
      const parts = cleaned.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
          return new Date(year, month - 1, day);
        }
      }
    }
    if (format === 'MM/DD/YYYY') {
      const parts = cleaned.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
          return new Date(year, month - 1, day);
        }
      }
    }
  }
  return null;
}

// Parse amount string with Romanian number formatting
export function parseAmount(amountStr: string, decimalSep: ',' | '.', thousandsSep: string): number {
  if (!amountStr || !amountStr.trim()) return 0;

  let cleaned = amountStr.trim();

  // Remove currency symbols
  cleaned = cleaned.replace(/[RON|EUR|USD|LEI]/gi, '').trim();

  // Remove spaces
  cleaned = cleaned.replace(/\s/g, '');

  // Remove thousands separator
  if (thousandsSep) {
    // Escape the separator for regex
    const escaped = thousandsSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(escaped, 'g'), '');
  }

  // Replace decimal separator with dot
  if (decimalSep === ',') {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100; // Round to 2 decimals
}

// Smart CSV line splitter that respects quoted fields
export function splitCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

export abstract class BaseCSVParser implements BankParser {
  abstract config: CSVParserConfig;

  get bankId(): string { return this.config.bankId; }
  get bankName(): string { return this.config.bankName; }
  get supportedFormats(): string[] { return ['csv']; }

  detect(content: string, filename: string): number {
    let confidence = 0;

    // Check filename for bank name hints
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.includes(this.config.bankId)) confidence += 20;

    // Check header patterns
    const firstLines = content.split('\n').slice(0, 10).join('\n');
    for (const pattern of this.config.headerPatterns) {
      if (pattern.test(firstLines)) {
        confidence += 40;
        break;
      }
    }

    // Check delimiter
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 1) {
      const delimCount = (lines[0].match(new RegExp(this.config.delimiter === '|' ? '\\|' : this.config.delimiter, 'g')) || []).length;
      if (delimCount >= 3) confidence += 20;
    }

    return Math.min(confidence, 100);
  }

  async parse(content: string): Promise<ParseResult> {
    const warnings: ValidationMessage[] = [];
    const errors: ValidationMessage[] = [];
    const transactions: ParsedTransaction[] = [];

    const lines = content.split(/\r?\n/).filter(l => l.trim());

    if (lines.length === 0) {
      return this.emptyResult('Fisierul este gol');
    }

    // Find the header row
    let headerIndex = this.findHeaderRow(lines);
    if (headerIndex === -1) {
      headerIndex = this.config.skipRows;
      warnings.push({
        code: 'HEADER_NOT_FOUND',
        message: 'Nu s-a putut identifica randul de antet. Se foloseste configuratia implicita.',
        severity: 'warning'
      });
    }

    // Parse data rows
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = splitCSVLine(line, this.config.delimiter);

      try {
        const tx = this.parseRow(fields, i + 1, line);
        if (tx) {
          transactions.push(tx);
        }
      } catch (err) {
        warnings.push({
          code: 'ROW_PARSE_ERROR',
          message: `Eroare la parsarea randului ${i + 1}: ${err instanceof Error ? err.message : 'eroare necunoscuta'}`,
          lineNumber: i + 1,
          severity: 'warning'
        });
      }
    }

    if (transactions.length === 0) {
      errors.push({
        code: 'NO_TRANSACTIONS',
        message: 'Nu s-au gasit tranzactii in fisier.',
        severity: 'critical'
      });
    }

    // Extract metadata
    const metadata = this.buildMetadata(lines, transactions);

    return {
      success: errors.filter(e => e.severity === 'critical').length === 0,
      transactions,
      warnings,
      errors,
      metadata,
      confidence: this.calculateConfidence(transactions, warnings, errors)
    };
  }

  protected findHeaderRow(lines: string[]): number {
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      for (const pattern of this.config.headerPatterns) {
        if (pattern.test(lines[i])) {
          return i;
        }
      }
    }
    return -1;
  }

  protected parseRow(fields: string[], lineNumber: number, rawLine: string): ParsedTransaction | null {
    const cm = this.config.columnMapping;

    // Extract date
    const dateStr = fields[cm.date] || '';
    const date = parseDate(dateStr, this.config.dateFormats);
    if (!date) return null; // Skip rows without valid date (likely footer/summary)

    // Extract description
    const description = (fields[cm.description] || '').replace(/"/g, '').trim();

    // Extract amounts
    let debit = 0;
    let credit = 0;

    if (this.config.amountInSingleColumn && cm.amount !== undefined) {
      const amount = parseAmount(fields[cm.amount] || '', this.config.decimalSeparator, this.config.thousandsSeparator);
      if (this.config.debitIsNegative) {
        if (amount < 0) debit = Math.abs(amount);
        else credit = amount;
      } else {
        // Check D/C indicator if available
        if (cm.dcIndicator !== undefined) {
          const indicator = (fields[cm.dcIndicator] || '').trim().toUpperCase();
          if (indicator === 'D' || indicator === 'DEBIT') debit = Math.abs(amount);
          else credit = Math.abs(amount);
        }
      }
    } else {
      debit = parseAmount(fields[cm.debit] || '', this.config.decimalSeparator, this.config.thousandsSeparator);
      credit = parseAmount(fields[cm.credit] || '', this.config.decimalSeparator, this.config.thousandsSeparator);
    }

    // Extract optional fields
    const reference = cm.reference !== undefined ? (fields[cm.reference] || '').trim() : '';
    const counterparty = cm.counterparty !== undefined ? (fields[cm.counterparty] || '').trim() : '';
    const iban = cm.iban !== undefined ? (fields[cm.iban] || '').trim() : '';
    const balance = cm.balance !== undefined
      ? parseAmount(fields[cm.balance] || '', this.config.decimalSeparator, this.config.thousandsSeparator) || null
      : null;

    return {
      date,
      description,
      debit: Math.abs(debit),
      credit: Math.abs(credit),
      currency: 'RON',
      reference,
      counterparty,
      iban,
      balance,
      rawLine,
      lineNumber
    };
  }

  protected buildMetadata(lines: string[], transactions: ParsedTransaction[]): ParseMetadata {
    const totalDebit = transactions.reduce((sum, tx) => sum + tx.debit, 0);
    const totalCredit = transactions.reduce((sum, tx) => sum + tx.credit, 0);

    const dates = transactions.map(tx => tx.date).sort((a, b) => a.getTime() - b.getTime());

    return {
      bank: this.config.bankId,
      bankName: this.config.bankName,
      format: 'csv',
      accountIban: this.extractIBAN(lines) || '',
      currency: 'RON',
      dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
      openingBalance: this.extractOpeningBalance(lines),
      closingBalance: this.extractClosingBalance(lines),
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      transactionCount: transactions.length,
      encoding: this.config.encoding
    };
  }

  // Override in subclasses for bank-specific extraction
  protected extractIBAN(lines: string[]): string | null {
    for (const line of lines.slice(0, 10)) {
      const match = line.match(/RO\d{2}[A-Z]{4}\d{16}/);
      if (match) return match[0];
    }
    return null;
  }

  protected extractOpeningBalance(lines: string[]): number | null {
    return null; // Override in subclasses
  }

  protected extractClosingBalance(lines: string[]): number | null {
    return null; // Override in subclasses
  }

  protected calculateConfidence(
    transactions: ParsedTransaction[],
    warnings: ValidationMessage[],
    errors: ValidationMessage[]
  ): number {
    let score = 100;

    if (transactions.length === 0) return 0;

    // Deduct for warnings
    score -= warnings.length * 5;

    // Deduct heavily for errors
    score -= errors.filter(e => e.severity === 'error').length * 15;
    score -= errors.filter(e => e.severity === 'critical').length * 40;

    // Check transaction quality
    const txWithZeroAmount = transactions.filter(tx => tx.debit === 0 && tx.credit === 0).length;
    score -= (txWithZeroAmount / transactions.length) * 30;

    const txWithEmptyDesc = transactions.filter(tx => !tx.description).length;
    score -= (txWithEmptyDesc / transactions.length) * 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private emptyResult(errorMsg: string): ParseResult {
    return {
      success: false,
      transactions: [],
      warnings: [],
      errors: [{ code: 'EMPTY_FILE', message: errorMsg, severity: 'critical' }],
      metadata: {
        bank: this.config.bankId,
        bankName: this.config.bankName,
        format: 'csv',
        accountIban: '',
        currency: 'RON',
        dateRange: null,
        openingBalance: null,
        closingBalance: null,
        totalDebit: 0,
        totalCredit: 0,
        transactionCount: 0,
        encoding: this.config.encoding
      },
      confidence: 0
    };
  }
}
