import { BaseCSVParser, type CSVParserConfig } from '../base-csv-parser';

export class AlphaParser extends BaseCSVParser {
  config: CSVParserConfig = {
    bankId: 'alpha',
    bankName: 'Alpha Bank Romania',
    delimiter: ';',
    dateFormats: ['DD.MM.YYYY', 'DD/MM/YYYY'],
    headerPatterns: [
      /Data/i,
      /Alpha\s*Bank/i,
      /Alpha\s*Web/i,
      /Descriere/i,
    ],
    columnMapping: {
      date: 0,
      description: 2,
      debit: 3,
      credit: 4,
      reference: 1,
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

    if (/BUCU/i.test(content)) confidence += 25; // Alpha Bank BIC
    if (/Alpha\s*Bank/i.test(content)) confidence += 25;
    if (/alpha/i.test(filename)) confidence += 20;

    return Math.min(confidence, 100);
  }

  protected extractIBAN(lines: string[]): string | null {
    for (const line of lines.slice(0, 15)) {
      const match = line.match(/RO\d{2}BUCU[A-Z0-9]{16}/);
      if (match) return match[0];
    }
    return super.extractIBAN(lines);
  }
}
