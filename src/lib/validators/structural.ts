import type { ParseResult, ValidationLayerResult, ValidationMessage } from '../parsers/types';

export function validateStructural(result: ParseResult): ValidationLayerResult {
  const messages: ValidationMessage[] = [];

  // Check for empty transactions
  if (result.transactions.length === 0) {
    messages.push({
      code: 'EMPTY_RESULT',
      message: 'Fisierul nu contine tranzactii.',
      severity: 'critical',
    });
  }

  // Check each transaction for required fields
  for (const tx of result.transactions) {
    // Date must be present
    if (!tx.date || isNaN(tx.date.getTime())) {
      messages.push({
        code: 'MISSING_DATE',
        message: `Randul ${tx.lineNumber}: data tranzactiei lipseste sau este invalida.`,
        lineNumber: tx.lineNumber,
        field: 'date',
        severity: 'error',
      });
    }

    // At least one of debit/credit must be non-zero
    if (tx.debit === 0 && tx.credit === 0) {
      messages.push({
        code: 'ZERO_AMOUNT',
        message: `Randul ${tx.lineNumber}: atat debitul cat si creditul sunt zero.`,
        lineNumber: tx.lineNumber,
        field: 'amount',
        severity: 'warning',
      });
    }

    // Cannot have both debit and credit non-zero
    if (tx.debit > 0 && tx.credit > 0) {
      messages.push({
        code: 'DUAL_AMOUNT',
        message: `Randul ${tx.lineNumber}: tranzactia are si debit (${tx.debit}) si credit (${tx.credit}). Verificati corectitudinea.`,
        lineNumber: tx.lineNumber,
        field: 'amount',
        severity: 'error',
      });
    }

    // Description should not be empty
    if (!tx.description || tx.description.trim().length === 0) {
      messages.push({
        code: 'EMPTY_DESCRIPTION',
        message: `Randul ${tx.lineNumber}: descrierea tranzactiei lipseste.`,
        lineNumber: tx.lineNumber,
        field: 'description',
        severity: 'warning',
      });
    }
  }

  // Check for exact duplicate rows
  const seen = new Map<string, number>();
  for (const tx of result.transactions) {
    const key = `${tx.date.toISOString()}_${tx.debit}_${tx.credit}_${tx.description}`;
    const prevLine = seen.get(key);
    if (prevLine !== undefined) {
      messages.push({
        code: 'DUPLICATE_ROW',
        message: `Randurile ${prevLine} si ${tx.lineNumber}: posibil duplicat (aceeasi data, suma si descriere).`,
        lineNumber: tx.lineNumber,
        severity: 'warning',
      });
    }
    seen.set(key, tx.lineNumber);
  }

  const hasBlocking = messages.some(m => m.severity === 'critical' || m.severity === 'error');
  const warningCount = messages.filter(m => m.severity === 'warning').length;
  const errorCount = messages.filter(m => m.severity === 'error' || m.severity === 'critical').length;

  let score = 100;
  score -= errorCount * 20;
  score -= warningCount * 5;

  return {
    layer: 'structural',
    passed: !hasBlocking,
    hasBlockingErrors: messages.some(m => m.severity === 'critical'),
    messages,
    score: Math.max(0, Math.min(100, score)),
  };
}
