import { BaseCSVParser, type CSVParserConfig } from '../base-csv-parser';

export class UniCreditParser extends BaseCSVParser {
  config: CSVParserConfig = {
    bankId: 'unicredit',
    bankName: 'UniCredit Bank Romania',
    delimiter: ';',
    dateFormats: ['DD.MM.YYYY', 'YYYY-MM-DD'],
    headerPatterns: [
      /Data\s*(operatiunii|valutei|tranzactiei)/i,
      /UniCredit/i,
      /Descriere/i,
    ],
    columnMapping: {
      date: 0,
      description: 2,
      debit: 3,
      credit: 4,
      reference: 1,
      counterparty: 5,
      iban: 6,
      balance: 7,
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

    if (/BACXROBU/i.test(content) || /BACX/i.test(content)) confidence += 25;
    if (/UniCredit/i.test(content)) confidence += 25;

    return Math.min(confidence, 100);
  }

  protected extractIBAN(lines: string[]): string | null {
    for (const line of lines.slice(0, 15)) {
      const match = line.match(/RO\d{2}BACX[A-Z0-9]{16}/);
      if (match) return match[0];
    }
    return super.extractIBAN(lines);
  }
}
