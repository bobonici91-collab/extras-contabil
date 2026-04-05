import type { BankParser, ParseResult, ParseOptions } from './types';
import { BCRParser } from './csv/bcr';
import { BRDParser } from './csv/brd';
import { BTParser } from './csv/bt';
import { INGParser } from './csv/ing';
import { RaiffeisenParser } from './csv/raiffeisen';
import { CECParser } from './csv/cec';
import { UniCreditParser } from './csv/unicredit';
import { OTPParser } from './csv/otp';
import { AlphaParser } from './csv/alpha';
import { MT940Parser } from './mt940';
import { CAMT053Parser } from './camt053';

// All available parsers
const ALL_PARSERS: BankParser[] = [
  new BCRParser(),
  new BRDParser(),
  new BTParser(),
  new INGParser(),
  new RaiffeisenParser(),
  new CECParser(),
  new UniCreditParser(),
  new OTPParser(),
  new AlphaParser(),
  new MT940Parser(),
  new CAMT053Parser(),
];

// Bank ID to parser mapping
const PARSER_MAP = new Map<string, BankParser>();
ALL_PARSERS.forEach(p => PARSER_MAP.set(p.bankId, p));

export interface DetectionResult {
  bankId: string;
  bankName: string;
  format: string;
  confidence: number;
}

// Auto-detect bank and format from file content
export function detectBank(content: string, filename: string): DetectionResult[] {
  const results: DetectionResult[] = [];

  for (const parser of ALL_PARSERS) {
    const confidence = parser.detect(content, filename);
    if (confidence > 10) {
      results.push({
        bankId: parser.bankId,
        bankName: parser.bankName,
        format: parser.supportedFormats[0],
        confidence,
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

// Get parser by bank ID
export function getParser(bankId: string): BankParser | null {
  return PARSER_MAP.get(bankId) || null;
}

// Parse file with auto-detection or specified bank
export async function parseFile(content: string, options?: ParseOptions, rawBuffer?: Buffer): Promise<ParseResult> {
  let parser: BankParser | null = null;

  if (options?.bankId) {
    parser = getParser(options.bankId);
    if (!parser) {
      return {
        success: false,
        transactions: [],
        warnings: [],
        errors: [{
          code: 'UNKNOWN_BANK',
          message: `Banca "${options.bankId}" nu este suportata.`,
          severity: 'critical',
        }],
        metadata: {
          bank: options.bankId || '',
          bankName: '',
          format: '',
          accountIban: '',
          currency: 'RON',
          dateRange: null,
          openingBalance: null,
          closingBalance: null,
          totalDebit: 0,
          totalCredit: 0,
          transactionCount: 0,
          encoding: 'utf-8',
        },
        confidence: 0,
      };
    }
  } else {
    // Auto-detect
    const detections = detectBank(content, options?.format || '');
    if (detections.length > 0 && detections[0].confidence >= 30) {
      parser = getParser(detections[0].bankId);
    }
  }

  if (!parser) {
    return {
      success: false,
      transactions: [],
      warnings: [],
      errors: [{
        code: 'DETECTION_FAILED',
        message: 'Nu s-a putut detecta automat formatul fisierului. Va rugam selectati banca manual.',
        severity: 'critical',
      }],
      metadata: {
        bank: '',
        bankName: '',
        format: '',
        accountIban: '',
        currency: 'RON',
        dateRange: null,
        openingBalance: null,
        closingBalance: null,
        totalDebit: 0,
        totalCredit: 0,
        transactionCount: 0,
        encoding: 'utf-8',
      },
      confidence: 0,
    };
  }

  return parser.parse(content, rawBuffer);
}

// List all supported banks
export function getSupportedBanks(): { id: string; name: string; formats: string[] }[] {
  return ALL_PARSERS.map(p => ({
    id: p.bankId,
    name: p.bankName,
    formats: p.supportedFormats,
  }));
}

export { ALL_PARSERS };
