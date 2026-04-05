import { BaseCSVParser, type CSVParserConfig } from '../base-csv-parser';

export class OTPParser extends BaseCSVParser {
  config: CSVParserConfig = {
    bankId: 'otp',
    bankName: 'OTP Bank Romania',
    delimiter: ';',
    dateFormats: ['DD.MM.YYYY', 'DD/MM/YYYY'],
    headerPatterns: [
      /Data/i,
      /OTP/i,
      /OTPdirekt/i,
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

    if (/OTPVROBU/i.test(content) || /OTPV/i.test(content)) confidence += 25;
    if (/OTP\s*Bank/i.test(content)) confidence += 25;
    if (/OTPdirekt/i.test(content)) confidence += 20;

    return Math.min(confidence, 100);
  }

  protected extractIBAN(lines: string[]): string | null {
    for (const line of lines.slice(0, 15)) {
      const match = line.match(/RO\d{2}OTPV[A-Z0-9]{16}/);
      if (match) return match[0];
    }
    return super.extractIBAN(lines);
  }
}
