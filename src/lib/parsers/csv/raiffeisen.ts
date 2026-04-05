import { BaseCSVParser, type CSVParserConfig } from '../base-csv-parser';

export class RaiffeisenParser extends BaseCSVParser {
  config: CSVParserConfig = {
    bankId: 'raiffeisen',
    bankName: 'Raiffeisen Bank Romania',
    delimiter: ';',
    dateFormats: ['DD.MM.YYYY', 'DD/MM/YYYY'],
    headerPatterns: [
      /Data\s*(operatiunii|tranzactiei)/i,
      /Raiffeisen/i,
      /Descriere\s*operatiune/i,
    ],
    columnMapping: {
      date: 0,
      description: 2,
      debit: 3,
      credit: 4,
      reference: 1,
      counterparty: 5,
      balance: 6,
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

    if (/RZBRROBU/i.test(content) || /RZBR/i.test(content)) confidence += 25;
    if (/Raiffeisen/i.test(content)) confidence += 25;
    if (/raiffeisen/i.test(filename)) confidence += 20;

    return Math.min(confidence, 100);
  }

  protected extractIBAN(lines: string[]): string | null {
    for (const line of lines.slice(0, 15)) {
      const match = line.match(/RO\d{2}RZBR[A-Z0-9]{16}/);
      if (match) return match[0];
    }
    return super.extractIBAN(lines);
  }
}
