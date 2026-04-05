import { BaseCSVParser, type CSVParserConfig } from '../base-csv-parser';

export class BTParser extends BaseCSVParser {
  config: CSVParserConfig = {
    bankId: 'bt',
    bankName: 'Banca Transilvania',
    delimiter: ',',
    dateFormats: ['DD.MM.YYYY', 'YYYY-MM-DD', 'DD/MM/YYYY'],
    headerPatterns: [
      /Data/i,
      /Banca\s*Transilvania/i,
      /BT24/i,
      /Detalii\s*tranzactie/i,
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
    encoding: 'utf-8',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    hasHeaderRow: true,
    amountInSingleColumn: false,
    debitIsNegative: false,
  };

  detect(content: string, filename: string): number {
    let confidence = super.detect(content, filename);

    if (/BTRL/i.test(content)) confidence += 25; // BT BIC code
    if (/BT24/i.test(content)) confidence += 20;
    if (/Banca\s*Transilvania/i.test(content)) confidence += 25;
    if (/bancatransilvania/i.test(filename)) confidence += 20;

    return Math.min(confidence, 100);
  }

  protected extractIBAN(lines: string[]): string | null {
    for (const line of lines.slice(0, 15)) {
      const match = line.match(/RO\d{2}BTRL[A-Z0-9]{16}/);
      if (match) return match[0];
    }
    return super.extractIBAN(lines);
  }

  protected extractOpeningBalance(lines: string[]): number | null {
    for (const line of lines.slice(0, 10)) {
      const match = line.match(/[Ss]old\s*(initial|anterior)\s*[;:,]?\s*([\d.,]+)/);
      if (match) {
        return parseFloat(match[2].replace('.', '').replace(',', '.'));
      }
    }
    return null;
  }

  protected extractClosingBalance(lines: string[]): number | null {
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
      const match = lines[i].match(/[Ss]old\s*(final|curent)\s*[;:,]?\s*([\d.,]+)/);
      if (match) {
        return parseFloat(match[2].replace('.', '').replace(',', '.'));
      }
    }
    return null;
  }
}
