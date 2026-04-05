import { BaseCSVParser, type CSVParserConfig } from '../base-csv-parser';

export class CECParser extends BaseCSVParser {
  config: CSVParserConfig = {
    bankId: 'cec',
    bankName: 'CEC Bank',
    delimiter: ';',
    dateFormats: ['DD.MM.YYYY', 'DD/MM/YYYY'],
    headerPatterns: [
      /Data/i,
      /CEC\s*Bank/i,
      /Descriere/i,
    ],
    columnMapping: {
      date: 0,
      description: 1,
      debit: 2,
      credit: 3,
      reference: 4,
      balance: 5,
    },
    skipRows: 1,
    encoding: 'windows-1250',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    hasHeaderRow: true,
    amountInSingleColumn: false,
    debitIsNegative: false,
  };

  detect(content: string, filename: string): number {
    let confidence = super.detect(content, filename);

    if (/CECEROBU/i.test(content) || /CECE/i.test(content)) confidence += 25;
    if (/CEC\s*Bank/i.test(content)) confidence += 25;

    return Math.min(confidence, 100);
  }

  protected extractIBAN(lines: string[]): string | null {
    for (const line of lines.slice(0, 15)) {
      const match = line.match(/RO\d{2}CECE[A-Z0-9]{16}/);
      if (match) return match[0];
    }
    return super.extractIBAN(lines);
  }
}
