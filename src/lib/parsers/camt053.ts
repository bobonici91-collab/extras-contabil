import type { BankParser, ParseResult, ParsedTransaction, ValidationMessage } from './types';

// Simple XML helper - extract text between tags
function getTagContent(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function getAllTagContents(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function getAttributeValue(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

export class CAMT053Parser implements BankParser {
  bankId = 'camt053';
  bankName = 'Format CAMT.053 (ISO 20022)';
  supportedFormats = ['xml', 'camt053'];

  detect(content: string, filename: string): number {
    let confidence = 0;

    if (content.includes('BkToCstmrStmt')) confidence += 30;
    if (content.includes('camt.053')) confidence += 30;
    if (content.includes('iso:std:iso:20022')) confidence += 20;
    if (content.includes('<Ntry>')) confidence += 15;

    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'xml') confidence += 10;

    return Math.min(confidence, 100);
  }

  async parse(content: string): Promise<ParseResult> {
    const warnings: ValidationMessage[] = [];
    const errors: ValidationMessage[] = [];
    const transactions: ParsedTransaction[] = [];

    // Extract statement
    const stmtContent = getTagContent(content, 'Stmt');
    if (!stmtContent) {
      errors.push({
        code: 'NO_STATEMENT',
        message: 'Nu s-a gasit elementul Stmt in fisierul CAMT.053.',
        severity: 'critical',
      });
      return this.emptyResult(errors);
    }

    // Extract account IBAN
    const acctContent = getTagContent(stmtContent, 'Acct');
    const iban = getTagContent(acctContent, 'IBAN');
    const currency = getTagContent(acctContent, 'Ccy') || 'RON';

    // Extract balances
    let openingBalance: number | null = null;
    let closingBalance: number | null = null;

    const balances = getAllTagContents(stmtContent, 'Bal');
    for (const bal of balances) {
      const typeCode = getTagContent(getTagContent(bal, 'CdOrPrtry'), 'Cd');
      const amountXml = getTagContent(bal, 'Amt');
      const cdtDbt = getTagContent(bal, 'CdtDbtInd');

      // Parse amount from Amt tag (may have Ccy attribute)
      const amount = parseFloat(amountXml) || 0;
      const signedAmount = cdtDbt === 'DBIT' ? -amount : amount;

      if (typeCode === 'OPBD') openingBalance = signedAmount;
      else if (typeCode === 'CLBD') closingBalance = signedAmount;
    }

    // Extract entries (transactions)
    const entries = getAllTagContents(stmtContent, 'Ntry');
    let lineNumber = 0;

    for (const entry of entries) {
      lineNumber++;

      try {
        const amountStr = getTagContent(entry, 'Amt');
        const amount = parseFloat(amountStr) || 0;
        const cdtDbtInd = getTagContent(entry, 'CdtDbtInd');

        // Date
        const bookingDateStr = getTagContent(getTagContent(entry, 'BookgDt'), 'Dt')
          || getTagContent(getTagContent(entry, 'ValDt'), 'Dt');

        let date: Date | null = null;
        if (bookingDateStr) {
          const parts = bookingDateStr.split('-');
          if (parts.length === 3) {
            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
        }

        if (!date) {
          warnings.push({
            code: 'INVALID_DATE',
            message: `Intrarea ${lineNumber}: data invalida "${bookingDateStr}"`,
            lineNumber,
            severity: 'warning',
          });
          continue;
        }

        // Description
        const txDtls = getTagContent(entry, 'NtryDtls');
        const rmtInf = getTagContent(txDtls, 'RmtInf');
        const description = getTagContent(rmtInf, 'Ustrd')
          || getTagContent(entry, 'AddtlNtryInf')
          || '';

        // Reference
        const refs = getTagContent(txDtls, 'Refs');
        const reference = getTagContent(refs, 'EndToEndId')
          || getTagContent(refs, 'AcctSvcrRef')
          || '';

        // Counterparty
        const rltdPties = getTagContent(txDtls, 'RltdPties');
        let counterparty = '';
        let counterpartyIban = '';

        if (cdtDbtInd === 'DBIT') {
          // We paid someone - get creditor
          const cdtr = getTagContent(rltdPties, 'Cdtr');
          counterparty = getTagContent(cdtr, 'Nm');
          const cdtrAcct = getTagContent(rltdPties, 'CdtrAcct');
          counterpartyIban = getTagContent(cdtrAcct, 'IBAN');
        } else {
          // We received payment - get debtor
          const dbtr = getTagContent(rltdPties, 'Dbtr');
          counterparty = getTagContent(dbtr, 'Nm');
          const dbtrAcct = getTagContent(rltdPties, 'DbtrAcct');
          counterpartyIban = getTagContent(dbtrAcct, 'IBAN');
        }

        const isDebit = cdtDbtInd === 'DBIT';

        transactions.push({
          date,
          description,
          debit: isDebit ? Math.round(amount * 100) / 100 : 0,
          credit: isDebit ? 0 : Math.round(amount * 100) / 100,
          currency: getAttributeValue(entry, 'Amt', 'Ccy') || currency,
          reference,
          counterparty,
          iban: counterpartyIban,
          balance: null,
          rawLine: entry.substring(0, 200),
          lineNumber,
        });
      } catch (err) {
        warnings.push({
          code: 'ENTRY_PARSE_ERROR',
          message: `Eroare la parsarea intrarii ${lineNumber}: ${err instanceof Error ? err.message : 'eroare necunoscuta'}`,
          lineNumber,
          severity: 'warning',
        });
      }
    }

    if (transactions.length === 0) {
      errors.push({
        code: 'NO_TRANSACTIONS',
        message: 'Nu s-au gasit tranzactii (Ntry) in fisierul CAMT.053.',
        severity: 'critical',
      });
    }

    const totalDebit = transactions.reduce((s, t) => s + t.debit, 0);
    const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);
    const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());

    return {
      success: errors.filter(e => e.severity === 'critical').length === 0,
      transactions,
      warnings,
      errors,
      metadata: {
        bank: 'camt053',
        bankName: 'CAMT.053 (ISO 20022)',
        format: 'camt053',
        accountIban: iban,
        currency,
        dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
        openingBalance,
        closingBalance,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        transactionCount: transactions.length,
        encoding: 'utf-8',
      },
      confidence: transactions.length > 0 ? 90 : 0,
    };
  }

  private emptyResult(errors: ValidationMessage[]): ParseResult {
    return {
      success: false,
      transactions: [],
      warnings: [],
      errors,
      metadata: {
        bank: 'camt053',
        bankName: 'CAMT.053 (ISO 20022)',
        format: 'camt053',
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
}
