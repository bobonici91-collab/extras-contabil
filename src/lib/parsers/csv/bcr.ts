import { BaseCSVParser, type CSVParserConfig } from '../base-csv-parser';

export class BCRParser extends BaseCSVParser {
  config: CSVParserConfig = {
    bankId: 'bcr',
    bankName: 'Banca Comerciala Romana (BCR)',
    delimiter: ',',
    dateFormats: ['DD.MM.YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
    headerPatterns: [
      /Data\s*(operatiuni|tranzactie|procesare)/i,
      /BCR/i,
      /George/i,
      /Banca\s*Comerciala\s*Romana/i,
    ],
    columnMapping: {
      date: 0,
      description: 2,
      debit: 4,
      credit: 5,
      reference: 1,
      balance: 6,
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

    // BCR George exports specific patterns
    if (/george/i.test(content)) confidence += 20;
    if (/RNCB/i.test(content)) confidence += 25; // BCR BIC code
    if (/Banca Comerciala Romana/i.test(content)) confidence += 25;

    return Math.min(confidence, 100);
  }

  protected extractIBAN(lines: string[]): string | null {
    for (const line of lines.slice(0, 15)) {
      const match = line.match(/RO\d{2}RNCB[A-Z0-9]{16}/);
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
