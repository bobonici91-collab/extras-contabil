import { BaseCSVParser, type CSVParserConfig } from '../base-csv-parser';

export class INGParser extends BaseCSVParser {
  config: CSVParserConfig = {
    bankId: 'ing',
    bankName: 'ING Bank Romania',
    delimiter: ',',
    dateFormats: ['DD.MM.YYYY', 'YYYY-MM-DD', 'DD/MM/YYYY'],
    headerPatterns: [
      /Data/i,
      /ING/i,
      /HomeBank/i,
      /Detalii/i,
    ],
    columnMapping: {
      date: 0,
      description: 1,
      debit: 3,
      credit: 4,
      reference: 2,
      balance: 5,
    },
    skipRows: 1,
    encoding: 'utf-8',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    hasHeaderRow: true,
    amountInSingleColumn: false,
    debitIsNegative: false,
  };

  detect(content: string, filename: string): number {
    let confidence = super.detect(content, filename);

    if (/INGB/i.test(content)) confidence += 25; // ING BIC code
    if (/HomeBank/i.test(content)) confidence += 20;
    if (/ING\s*Bank/i.test(content)) confidence += 25;

    return Math.min(confidence, 100);
  }

  protected extractIBAN(lines: string[]): string | null {
    for (const line of lines.slice(0, 15)) {
      const match = line.match(/RO\d{2}INGB[A-Z0-9]{16}/);
      if (match) return match[0];
    }
    return super.extractIBAN(lines);
  }
}
