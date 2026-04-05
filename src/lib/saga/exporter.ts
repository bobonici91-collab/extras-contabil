import type { ParsedTransaction, SAGAExportResult, SAGATransaction } from '../parsers/types';
import { formatDateSAGA, formatAmountSAGA, sanitizeDescription } from './formatter';
import { encodeWindows1250 } from './encoder';

export interface ExportOptions {
  includeHeader: boolean;
  encoding: 'windows-1250' | 'utf-8';
  delimiter: string;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeHeader: true,
  encoding: 'windows-1250',
  delimiter: ';',
};

// Transform parsed transactions to SAGA format
export function toSAGATransactions(transactions: ParsedTransaction[]): SAGATransaction[] {
  return transactions.map(tx => ({
    data: formatDateSAGA(tx.date),
    explicatie: sanitizeDescription(tx.description),
    sumaDebit: tx.debit > 0 ? formatAmountSAGA(tx.debit) : '',
    sumaCredit: tx.credit > 0 ? formatAmountSAGA(tx.credit) : '',
    numarDocument: tx.reference || '',
  }));
}

// Generate SAGA-compatible CSV content
export function generateSAGAContent(
  sagaTxs: SAGATransaction[],
  options: Partial<ExportOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  // Header row
  if (opts.includeHeader) {
    lines.push(['Data', 'Explicatie', 'Suma Debit', 'Suma Credit', 'Numar Document'].join(opts.delimiter));
  }

  // Transaction rows
  for (const tx of sagaTxs) {
    lines.push([
      tx.data,
      tx.explicatie,
      tx.sumaDebit,
      tx.sumaCredit,
      tx.numarDocument,
    ].join(opts.delimiter));
  }

  return lines.join('\r\n') + '\r\n'; // Windows line endings
}

// Full export pipeline with verification
export function exportToSAGA(
  transactions: ParsedTransaction[],
  options: Partial<ExportOptions> = {}
): SAGAExportResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Step 1: Transform to SAGA format
  const sagaTxs = toSAGATransactions(transactions);

  // Step 2: Generate CSV content
  const content = generateSAGAContent(sagaTxs, opts);

  // Step 3: Encode
  let buffer: Buffer;
  if (opts.encoding === 'windows-1250') {
    buffer = encodeWindows1250(content);
  } else {
    // UTF-8 with BOM
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    buffer = Buffer.concat([bom, Buffer.from(content, 'utf-8')]);
  }

  // Step 4: Calculate totals from output for verification
  const outputTotalDebit = sagaTxs.reduce((sum, tx) => {
    return sum + parseRomanianAmount(tx.sumaDebit);
  }, 0);

  const outputTotalCredit = sagaTxs.reduce((sum, tx) => {
    return sum + parseRomanianAmount(tx.sumaCredit);
  }, 0);

  // Step 5: Round-trip verification
  const inputTotalDebit = Math.round(transactions.reduce((sum, tx) => sum + tx.debit, 0) * 100) / 100;
  const inputTotalCredit = Math.round(transactions.reduce((sum, tx) => sum + tx.credit, 0) * 100) / 100;

  const debitMatch = Math.abs(outputTotalDebit - inputTotalDebit) < 0.01;
  const creditMatch = Math.abs(outputTotalCredit - inputTotalCredit) < 0.01;
  const countMatch = sagaTxs.length === transactions.length;

  const verified = debitMatch && creditMatch && countMatch;

  return {
    content,
    encoding: opts.encoding,
    transactionCount: sagaTxs.length,
    totalDebit: outputTotalDebit,
    totalCredit: outputTotalCredit,
    verified,
    buffer,
  };
}

// Parse Romanian amount string back to number (for verification)
function parseRomanianAmount(str: string): number {
  if (!str || !str.trim()) return 0;
  // Remove thousands separator (.) and replace decimal separator (,) with (.)
  const cleaned = str.replace(/\./g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned) * 100) / 100 || 0;
}
