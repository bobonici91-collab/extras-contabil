import type { ParseResult, ValidationLayerResult, ValidationMessage } from '../parsers/types';

const TOLERANCE = 0.01; // 1 ban tolerance for floating point

export function validateFinancial(result: ParseResult): ValidationLayerResult {
  const messages: ValidationMessage[] = [];
  const { metadata, transactions } = result;

  // Calculate totals from transactions
  const calcTotalDebit = transactions.reduce((sum, tx) => sum + tx.debit, 0);
  const calcTotalCredit = transactions.reduce((sum, tx) => sum + tx.credit, 0);

  // Round to avoid floating point issues
  const roundedDebit = Math.round(calcTotalDebit * 100) / 100;
  const roundedCredit = Math.round(calcTotalCredit * 100) / 100;

  // Verify total debit matches metadata
  if (metadata.totalDebit > 0 && Math.abs(roundedDebit - metadata.totalDebit) > TOLERANCE) {
    messages.push({
      code: 'TOTAL_DEBIT_MISMATCH',
      message: `Totalul debitelor calculate (${formatRON(roundedDebit)}) difera de totalul raportat (${formatRON(metadata.totalDebit)}). Diferenta: ${formatRON(Math.abs(roundedDebit - metadata.totalDebit))}.`,
      severity: 'error',
    });
  }

  // Verify total credit matches metadata
  if (metadata.totalCredit > 0 && Math.abs(roundedCredit - metadata.totalCredit) > TOLERANCE) {
    messages.push({
      code: 'TOTAL_CREDIT_MISMATCH',
      message: `Totalul creditelor calculate (${formatRON(roundedCredit)}) difera de totalul raportat (${formatRON(metadata.totalCredit)}). Diferenta: ${formatRON(Math.abs(roundedCredit - metadata.totalCredit))}.`,
      severity: 'error',
    });
  }

  // CRITICAL: Balance reconciliation
  // opening_balance + total_credits - total_debits = closing_balance
  if (metadata.openingBalance !== null && metadata.closingBalance !== null) {
    const expectedClosing = Math.round(
      (metadata.openingBalance + roundedCredit - roundedDebit) * 100
    ) / 100;

    const diff = Math.abs(expectedClosing - metadata.closingBalance);

    if (diff > TOLERANCE) {
      messages.push({
        code: 'BALANCE_RECONCILIATION_FAILED',
        message: `EROARE SOLD: Sold initial (${formatRON(metadata.openingBalance)}) + Credite (${formatRON(roundedCredit)}) - Debituri (${formatRON(roundedDebit)}) = ${formatRON(expectedClosing)}, dar soldul final raportat este ${formatRON(metadata.closingBalance)}. Diferenta: ${formatRON(diff)}.`,
        severity: 'critical',
      });
    } else {
      messages.push({
        code: 'BALANCE_RECONCILIATION_OK',
        message: `Reconciliere sold reusita: Sold initial (${formatRON(metadata.openingBalance)}) + Credite (${formatRON(roundedCredit)}) - Debituri (${formatRON(roundedDebit)}) = Sold final (${formatRON(metadata.closingBalance)}).`,
        severity: 'info',
      });
    }
  } else {
    messages.push({
      code: 'NO_BALANCE_DATA',
      message: 'Soldul initial si/sau final nu sunt disponibile. Reconcilierea automata a soldului nu este posibila. Verificati manual totalurile.',
      severity: 'warning',
    });
  }

  // Verify running balance consistency (if available)
  const txWithBalance = transactions.filter(tx => tx.balance !== null);
  if (txWithBalance.length > 1) {
    let runningBalanceErrors = 0;

    for (let i = 1; i < txWithBalance.length; i++) {
      const prev = txWithBalance[i - 1];
      const curr = txWithBalance[i];

      if (prev.balance !== null && curr.balance !== null) {
        const expectedBalance = Math.round(
          (prev.balance + curr.credit - curr.debit) * 100
        ) / 100;

        if (Math.abs(expectedBalance - curr.balance) > TOLERANCE) {
          runningBalanceErrors++;
          if (runningBalanceErrors <= 5) { // Limit messages
            messages.push({
              code: 'RUNNING_BALANCE_ERROR',
              message: `Randul ${curr.lineNumber}: sold calculat (${formatRON(expectedBalance)}) difera de sold raportat (${formatRON(curr.balance)}). Diferenta: ${formatRON(Math.abs(expectedBalance - curr.balance))}.`,
              lineNumber: curr.lineNumber,
              severity: 'error',
            });
          }
        }
      }
    }

    if (runningBalanceErrors > 5) {
      messages.push({
        code: 'RUNNING_BALANCE_ERRORS_TRUNCATED',
        message: `Inca ${runningBalanceErrors - 5} erori de sold pe rand neafisate.`,
        severity: 'error',
      });
    }

    if (runningBalanceErrors === 0 && txWithBalance.length > 2) {
      messages.push({
        code: 'RUNNING_BALANCE_OK',
        message: `Verificare sold pe rand reusita pentru ${txWithBalance.length} tranzactii.`,
        severity: 'info',
      });
    }
  }

  // Check for penny precision (all amounts should have max 2 decimal places)
  for (const tx of transactions) {
    const debitCheck = Math.round(tx.debit * 100) / 100;
    const creditCheck = Math.round(tx.credit * 100) / 100;

    if (Math.abs(tx.debit - debitCheck) > 0.001 || Math.abs(tx.credit - creditCheck) > 0.001) {
      messages.push({
        code: 'PRECISION_ERROR',
        message: `Randul ${tx.lineNumber}: suma are mai mult de 2 zecimale (debit: ${tx.debit}, credit: ${tx.credit}). Sumele au fost rotunjite la 2 zecimale.`,
        lineNumber: tx.lineNumber,
        severity: 'warning',
      });
    }
  }

  const hasBlocking = messages.some(m => m.severity === 'critical');
  const errorCount = messages.filter(m => m.severity === 'error').length;

  let score = 100;
  if (hasBlocking) score -= 50;
  score -= errorCount * 15;

  return {
    layer: 'financial',
    passed: !hasBlocking,
    hasBlockingErrors: hasBlocking,
    messages,
    score: Math.max(0, Math.min(100, score)),
  };
}

function formatRON(amount: number): string {
  return amount.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' RON';
}
