import { BaseCSVParser, type CSVParserConfig } from '../base-csv-parser';

export class BRDParser extends BaseCSVParser {
  config: CSVParserConfig = {
    bankId: 'brd',
    bankName: 'BRD - Groupe Societe Generale',
    delimiter: ';',
    dateFormats: ['DD.MM.YYYY', 'DD/MM/YYYY'],
    headerPatterns: [
      /Data\s*tranzactie/i,
      /BRD/i,
      /MyBRD/i,
      /Societe\s*Generale/i,
    ],
    columnMapping: {
      date: 0,
      description: 3,
      debit: 4,
      credit: 5,
      reference: 1,
      counterparty: 2,
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

    if (/BRDE/i.test(content)) confidence += 25; // BRD BIC code
    if (/MyBRD/i.test(content)) confidence += 20;
    if (/BRD/i.test(content) && /Societe/i.test(content)) confidence += 25;

    return Math.min(confidence, 100);
  }

  protected extractIBAN(lines: string[]): string | null {
    for (const line of lines.slice(0, 15)) {
      const match = line.match(/RO\d{2}BRDE[A-Z0-9]{16}/);
      if (match) return match[0];
    }
    return super.extractIBAN(lines);
  }

  protected extractOpeningBalance(lines: string[]): number | null {
    for (const line of lines.slice(0, 10)) {
      const match = line.match(/[Ss]old\s*(initial|anterior|deschidere)\s*[;:,]?\s*([\d.,]+)/);
      if (match) {
        return parseFloat(match[2].replace('.', '').replace(',', '.'));
      }
    }
    return null;
  }

  protected extractClosingBalance(lines: string[]): number | null {
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
      const match = lines[i].match(/[Ss]old\s*(final|curent|inchidere)\s*[;:,]?\s*([\d.,]+)/);
      if (match) {
        return parseFloat(match[2].replace('.', '').replace(',', '.'));
      }
    }
    return null;
  }
}
