// Canonical transaction format - all parsers produce this
export interface ParsedTransaction {
  date: Date;
  description: string;
  debit: number;      // Always positive or 0
  credit: number;     // Always positive or 0
  currency: string;
  reference: string;
  counterparty: string;
  iban: string;
  balance: number | null;  // Running balance if available
  rawLine: string;
  lineNumber: number;
}

export interface ParseMetadata {
  bank: string;
  bankName: string;
  format: string;
  accountIban: string;
  currency: string;
  dateRange: { from: Date; to: Date } | null;
  openingBalance: number | null;
  closingBalance: number | null;
  totalDebit: number;
  totalCredit: number;
  transactionCount: number;
  encoding: string;
}

export interface ValidationMessage {
  code: string;
  message: string;        // Romanian user-facing message
  lineNumber?: number;
  field?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  warnings: ValidationMessage[];
  errors: ValidationMessage[];
  metadata: ParseMetadata;
  confidence: number;      // 0-100
}

export interface ValidationLayerResult {
  layer: string;
  passed: boolean;
  hasBlockingErrors: boolean;
  messages: ValidationMessage[];
  score: number;           // 0-100
}

export interface ValidationReport {
  layers: ValidationLayerResult[];
  overallScore: number;
  canExport: boolean;
  summary: string;
}

export interface BankParser {
  bankId: string;
  bankName: string;
  supportedFormats: string[];
  detect(content: string, filename: string): number; // 0-100 confidence
  parse(content: string, rawBuffer?: Buffer): Promise<ParseResult>;
}

export interface ParseOptions {
  bankId?: string;
  format?: string;
  encoding?: string;
}

// SAGA export format
export interface SAGATransaction {
  data: string;            // DD.MM.YYYY
  explicatie: string;
  sumaDebit: string;       // Romanian format: 1.234,56
  sumaCredit: string;
  numarDocument: string;
}

export interface SAGAExportResult {
  content: string;         // The CSV content
  encoding: 'windows-1250' | 'utf-8';
  transactionCount: number;
  totalDebit: number;
  totalCredit: number;
  verified: boolean;       // Round-trip verification passed
  buffer: Buffer;          // Encoded buffer ready for download
}
