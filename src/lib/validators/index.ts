import type { ParseResult, ValidationReport } from '../parsers/types';
import { validateStructural } from './structural';
import { validateEncoding } from './encoding';
import { validateSemantic } from './semantic';
import { validateFinancial } from './financial';
import { validateCrossCheck } from './cross-check';

export async function validateParsedResult(result: ParseResult): Promise<ValidationReport> {
  // Run all 5 validation layers
  const layers = [
    validateStructural(result),
    validateEncoding(result),
    validateSemantic(result),
    validateFinancial(result),
    validateCrossCheck(result),
  ];

  // Calculate overall score (weighted average)
  const weights = {
    structural: 0.20,
    encoding: 0.10,
    semantic: 0.20,
    financial: 0.35,  // Financial validation has highest weight
    'cross-check': 0.15,
  };

  let weightedScore = 0;
  for (const layer of layers) {
    const weight = weights[layer.layer as keyof typeof weights] || 0.2;
    weightedScore += layer.score * weight;
  }

  const overallScore = Math.round(weightedScore);
  const canExport = !layers.some(l => l.hasBlockingErrors);

  // Build summary
  const totalErrors = layers.reduce(
    (sum, l) => sum + l.messages.filter(m => m.severity === 'error' || m.severity === 'critical').length,
    0
  );
  const totalWarnings = layers.reduce(
    (sum, l) => sum + l.messages.filter(m => m.severity === 'warning').length,
    0
  );

  let summary: string;
  if (canExport && overallScore >= 90) {
    summary = `✓ Validare reusita (scor: ${overallScore}/100). ${result.transactions.length} tranzactii gata de export.`;
  } else if (canExport && overallScore >= 70) {
    summary = `⚠ Validare cu avertismente (scor: ${overallScore}/100). ${totalWarnings} avertismente. Exportul este posibil, dar verificati avertismentele.`;
  } else if (canExport) {
    summary = `⚠ Validare cu probleme (scor: ${overallScore}/100). ${totalErrors} erori, ${totalWarnings} avertismente. Exportul este posibil, dar recomandam corectarea problemelor.`;
  } else {
    summary = `✗ Validare esuata (scor: ${overallScore}/100). ${totalErrors} erori blocante. Exportul nu este posibil pana la rezolvarea erorilor critice.`;
  }

  return {
    layers,
    overallScore,
    canExport,
    summary,
  };
}

export { validateStructural, validateEncoding, validateSemantic, validateFinancial, validateCrossCheck };
