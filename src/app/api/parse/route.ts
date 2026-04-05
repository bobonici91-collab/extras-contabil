import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/config';
import { parseFile, detectBank } from '@/lib/parsers';
import { validateParsedResult } from '@/lib/validators';
import { decodeFileContent } from '@/lib/saga/encoder';

export async function POST(request: Request) {
  try {
    // Auth check
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesara.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bankId = formData.get('bankId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Fisierul este obligatoriu.' }, { status: 400 });
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Detect encoding and decode
    const { content, encoding } = decodeFileContent(buffer);

    // Auto-detect bank if not specified
    let detectedBank = bankId || '';
    if (!detectedBank) {
      const detections = detectBank(content, file.name);
      if (detections.length > 0) {
        detectedBank = detections[0].bankId;
      }
    }

    // Parse file
    const parseResult = await parseFile(content, {
      bankId: detectedBank || undefined,
      format: file.name.split('.').pop() || '',
      encoding,
    }, buffer);

    // Serialize dates for JSON
    const serializedTransactions = parseResult.transactions.map(tx => ({
      ...tx,
      date: formatDate(tx.date),
    }));

    const serializedMetadata = {
      ...parseResult.metadata,
      dateRange: parseResult.metadata.dateRange ? {
        from: formatDate(parseResult.metadata.dateRange.from),
        to: formatDate(parseResult.metadata.dateRange.to),
      } : null,
    };

    // Validate
    const validation = await validateParsedResult(parseResult);

    return NextResponse.json({
      parseResult: {
        ...parseResult,
        transactions: serializedTransactions,
        metadata: serializedMetadata,
      },
      validation,
      detection: !bankId ? detectBank(content, file.name).slice(0, 3) : undefined,
    });
  } catch (error) {
    console.error('Parse error:', error);
    return NextResponse.json({
      error: 'Eroare la procesarea fisierului. Verificati formatul si incercati din nou.',
    }, { status: 500 });
  }
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}
