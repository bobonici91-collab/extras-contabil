import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/config';
import { exportToSAGA } from '@/lib/saga/exporter';
import type { ParsedTransaction } from '@/lib/parsers/types';

export async function POST(request: Request) {
  try {
    // Auth check
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesara.' }, { status: 401 });
    }

    const body = await request.json();
    const { transactions, options } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'Nu exista tranzactii de exportat.' }, { status: 400 });
    }

    // Convert date strings back to Date objects
    const parsedTransactions: ParsedTransaction[] = transactions.map((tx: Record<string, unknown>) => ({
      date: parseRomanianDate(tx.date as string),
      description: (tx.description as string) || '',
      debit: Number(tx.debit) || 0,
      credit: Number(tx.credit) || 0,
      currency: (tx.currency as string) || 'RON',
      reference: (tx.reference as string) || '',
      counterparty: (tx.counterparty as string) || '',
      iban: (tx.iban as string) || '',
      balance: tx.balance != null ? Number(tx.balance) : null,
      rawLine: (tx.rawLine as string) || '',
      lineNumber: Number(tx.lineNumber) || 0,
    }));

    // Generate SAGA file
    const result = exportToSAGA(parsedTransactions, {
      includeHeader: options?.includeHeader ?? true,
      encoding: options?.encoding ?? 'windows-1250',
      delimiter: ';',
    });

    // Verify round-trip integrity
    if (!result.verified) {
      return NextResponse.json({
        error: 'Verificarea dubla a esuat. Datele de iesire nu corespund cu datele de intrare. Va rugam reincercati sau contactati suportul.',
      }, { status: 500 });
    }

    // Return file as download
    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=windows-1250',
        'Content-Disposition': `attachment; filename="extras_saga_${new Date().toISOString().slice(0, 10)}.csv"`,
        'X-Transaction-Count': String(result.transactionCount),
        'X-Total-Debit': String(result.totalDebit),
        'X-Total-Credit': String(result.totalCredit),
        'X-Verified': String(result.verified),
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({
      error: 'Eroare la generarea fisierului SAGA. Incercati din nou.',
    }, { status: 500 });
  }
}

function parseRomanianDate(dateStr: string): Date {
  // Parse DD.MM.YYYY format
  const parts = dateStr.split('.');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}
