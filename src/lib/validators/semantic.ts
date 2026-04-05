import type { ParseResult, ValidationLayerResult, ValidationMessage } from '../parsers/types';

export function validateSemantic(result: ParseResult): ValidationLayerResult {
  const messages: ValidationMessage[] = [];
  const now = new Date();

  for (const tx of result.transactions) {
    // Date in the future
    if (tx.date > now) {
      messages.push({
        code: 'FUTURE_DATE',
        message: `Randul ${tx.lineNumber}: data tranzactiei (${formatDate(tx.date)}) este in viitor.`,
        lineNumber: tx.lineNumber,
        field: 'date',
        severity: 'warning',
      });
    }

    // Date too old (before 2000)
    if (tx.date.getFullYear() < 2000) {
      messages.push({
        code: 'OLD_DATE',
        message: `Randul ${tx.lineNumber}: data tranzactiei (${formatDate(tx.date)}) este inainte de anul 2000. Verificati corectitudinea.`,
        lineNumber: tx.lineNumber,
        field: 'date',
        severity: 'error',
      });
    }

    // Unusually large amounts (> 10 million)
    const amount = tx.debit || tx.credit;
    if (amount > 10_000_000) {
      messages.push({
        code: 'LARGE_AMOUNT',
        message: `Randul ${tx.lineNumber}: suma foarte mare (${formatAmount(amount)} ${tx.currency}). Verificati corectitudinea.`,
        lineNumber: tx.lineNumber,
        field: 'amount',
        severity: 'warning',
      });
    }

    // Negative amounts (should not happen - we use separate debit/credit)
    if (tx.debit < 0 || tx.credit < 0) {
      messages.push({
        code: 'NEGATIVE_AMOUNT',
        message: `Randul ${tx.lineNumber}: suma negativa detectata (debit: ${tx.debit}, credit: ${tx.credit}). Sumele ar trebui sa fie pozitive.`,
        lineNumber: tx.lineNumber,
        field: 'amount',
        severity: 'error',
      });
    }
  }

  // Check date ordering - transactions should be roughly chronological
  let outOfOrderCount = 0;
  for (let i = 1; i < result.transactions.length; i++) {
    const prev = result.transactions[i - 1].date;
    const curr = result.transactions[i].date;
    // Allow same-day, but flag if going backwards by more than 1 day
    if (curr.getTime() < prev.getTime() - 86_400_000) {
      outOfOrderCount++;
    }
  }
  if (outOfOrderCount > result.transactions.length * 0.3) {
    messages.push({
      code: 'DATES_UNORDERED',
      message: `${outOfOrderCount} tranzactii nu sunt in ordine cronologica. Aceasta poate fi normala, dar verificati fisierul.`,
      severity: 'info',
    });
  }

  // Check date range consistency
  if (result.metadata.dateRange) {
    const rangeDays = Math.ceil(
      (result.metadata.dateRange.to.getTime() - result.metadata.dateRange.from.getTime()) / 86_400_000
    );
    if (rangeDays > 366) {
      messages.push({
        code: 'WIDE_DATE_RANGE',
        message: `Perioada extrasului este de ${rangeDays} zile (peste un an). Verificati ca fisierul nu contine extrase din perioade diferite.`,
        severity: 'warning',
      });
    }
  }

  // Advanced duplicate detection (same date + similar amount)
  const txByDate = new Map<string, typeof result.transactions>();
  for (const tx of result.transactions) {
    const dateKey = formatDate(tx.date);
    if (!txByDate.has(dateKey)) txByDate.set(dateKey, []);
    txByDate.get(dateKey)!.push(tx);
  }

  for (const [, dayTxs] of txByDate) {
    for (let i = 0; i < dayTxs.length; i++) {
      for (let j = i + 1; j < dayTxs.length; j++) {
        const a = dayTxs[i];
        const b = dayTxs[j];
        // Same amount and similar description = likely duplicate
        if (
          a.debit === b.debit && a.credit === b.credit &&
          a.debit + a.credit > 0 &&
          similarity(a.description, b.description) > 0.8
        ) {
          messages.push({
            code: 'LIKELY_DUPLICATE',
            message: `Randurile ${a.lineNumber} si ${b.lineNumber}: posibil duplicat - aceeasi data, aceeasi suma (${formatAmount(a.debit || a.credit)}), descrieri similare.`,
            lineNumber: b.lineNumber,
            severity: 'warning',
          });
        }
      }
    }
  }

  const hasBlocking = messages.some(m => m.severity === 'critical');
  const errorCount = messages.filter(m => m.severity === 'error').length;
  const warningCount = messages.filter(m => m.severity === 'warning').length;

  let score = 100;
  score -= errorCount * 15;
  score -= warningCount * 5;

  return {
    layer: 'semantic',
    passed: !hasBlocking,
    hasBlockingErrors: false,
    messages,
    score: Math.max(0, Math.min(100, score)),
  };
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatAmount(n: number): string {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Simple string similarity (Jaccard on trigrams)
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;

  const trigramsA = new Set<string>();
  const trigramsB = new Set<string>();

  for (let i = 0; i <= la.length - 3; i++) trigramsA.add(la.substring(i, i + 3));
  for (let i = 0; i <= lb.length - 3; i++) trigramsB.add(lb.substring(i, i + 3));

  if (trigramsA.size === 0 || trigramsB.size === 0) return 0;

  let intersection = 0;
  for (const t of trigramsA) if (trigramsB.has(t)) intersection++;

  return intersection / (trigramsA.size + trigramsB.size - intersection);
}
