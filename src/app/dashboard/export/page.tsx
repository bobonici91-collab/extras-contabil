'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ExportData {
  parseResult: {
    transactions: Array<{
      date: string;
      description: string;
      debit: number;
      credit: number;
      reference: string;
      lineNumber: number;
    }>;
    metadata: {
      bankName: string;
      totalDebit: number;
      totalCredit: number;
      transactionCount: number;
    };
  };
  validation: {
    canExport: boolean;
    overallScore: number;
  };
}

export default function ExportPage() {
  const router = useRouter();
  const [data, setData] = useState<ExportData | null>(null);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [encoding, setEncoding] = useState<'windows-1250' | 'utf-8'>('windows-1250');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('parseResult');
    if (stored) setData(JSON.parse(stored));
  }, []);

  async function handleExport() {
    if (!data) return;
    setExporting(true);
    setError('');

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          transactions: data.parseResult.transactions,
          options: { includeHeader, encoding },
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || 'Eroare la generarea fisierului');
        return;
      }

      // Download file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extras_saga_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExported(true);
    } catch {
      setError('Eroare de conexiune. Incercati din nou.');
    } finally {
      setExporting(false);
    }
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-gray-500 text-lg mb-4">Nu exista date de exportat.</p>
        <button onClick={() => router.push('/dashboard/upload')} className="text-blue-600 font-medium hover:text-blue-700">
          Incarca un extras de cont
        </button>
      </div>
    );
  }

  const { parseResult, validation } = data;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Export SAGA</h1>
      <p className="text-gray-500 mb-8">Genereaza fisierul CSV compatibil cu SAGA</p>

      {/* Summary */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="font-bold text-gray-900 mb-4">Sumar Export</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Banca:</span>
            <span className="ml-2 font-medium">{parseResult.metadata.bankName}</span>
          </div>
          <div>
            <span className="text-gray-500">Tranzactii:</span>
            <span className="ml-2 font-medium">{parseResult.transactions.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Debit:</span>
            <span className="ml-2 font-medium text-red-600">{formatRON(parseResult.metadata.totalDebit)}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Credit:</span>
            <span className="ml-2 font-medium text-green-600">{formatRON(parseResult.metadata.totalCredit)}</span>
          </div>
          <div>
            <span className="text-gray-500">Scor Validare:</span>
            <span className={`ml-2 font-medium ${validation.overallScore >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
              {validation.overallScore}/100
            </span>
          </div>
        </div>
      </div>

      {/* Export options */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="font-bold text-gray-900 mb-4">Optiuni Export</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="includeHeader"
              checked={includeHeader}
              onChange={e => setIncludeHeader(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="includeHeader" className="text-sm text-gray-700">
              Include rand antet (Data;Explicatie;Suma Debit;Suma Credit;Numar Document)
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Codificare fisier</label>
            <select
              value={encoding}
              onChange={e => setEncoding(e.target.value as 'windows-1250' | 'utf-8')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="windows-1250">Windows-1250 (recomandat pentru SAGA)</option>
              <option value="utf-8">UTF-8</option>
            </select>
          </div>
        </div>
      </div>

      {/* Preview of first lines */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="font-bold text-gray-900 mb-4">Previzualizare Fisier SAGA</h2>
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
          {includeHeader && <div className="text-gray-500">Data;Explicatie;Suma Debit;Suma Credit;Numar Document</div>}
          {parseResult.transactions.slice(0, 5).map((tx, i) => (
            <div key={i} className="text-gray-700">
              {tx.date};{tx.description};{tx.debit > 0 ? formatRomanianAmount(tx.debit) : ''};{tx.credit > 0 ? formatRomanianAmount(tx.credit) : ''};{tx.reference}
            </div>
          ))}
          {parseResult.transactions.length > 5 && (
            <div className="text-gray-400 mt-1">... inca {parseResult.transactions.length - 5} randuri</div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>
      )}

      {/* Export button */}
      {!exported ? (
        <button
          onClick={handleExport}
          disabled={exporting || !validation.canExport}
          className={`w-full py-3 rounded-lg font-medium text-lg transition ${
            validation.canExport
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          } disabled:opacity-50`}
        >
          {exporting ? 'Se genereaza...' : 'Descarca Fisier SAGA'}
        </button>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-3">{'\u2705'}</div>
          <h3 className="font-bold text-green-800 text-lg mb-2">Fisier generat cu succes!</h3>
          <p className="text-green-700 text-sm mb-4">
            Fisierul a fost descarcat. Verificarea dubla a confirmat ca datele de iesire corespund cu datele de intrare.
          </p>
          <div className="flex gap-4 justify-center">
            <button onClick={handleExport} className="text-blue-600 font-medium text-sm hover:text-blue-700">
              Descarca din nou
            </button>
            <button onClick={() => router.push('/dashboard/upload')} className="text-blue-600 font-medium text-sm hover:text-blue-700">
              Incarca alt extras
            </button>
          </div>
        </div>
      )}

      {/* SAGA Import Instructions */}
      <div className="mt-8">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700"
        >
          <span>{showInstructions ? '\u25BC' : '\u25B6'}</span>
          Cum import fisierul in SAGA?
        </button>

        {showInstructions && (
          <div className="mt-4 bg-blue-50 rounded-xl border border-blue-100 p-6 animate-fade-in">
            <ol className="space-y-4 text-sm text-blue-900">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <strong>Deschide SAGA</strong> si navigheaza la <code className="bg-blue-100 px-1 rounded">Fisier &rarr; Import &rarr; Import extras de cont</code> sau <code className="bg-blue-100 px-1 rounded">Banca &rarr; Import extras bancar</code>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <div>
                  <strong>Selecteaza fisierul</strong> CSV descarcat din ExtrasContabil. Asigura-te ca separatorul este setat pe <code className="bg-blue-100 px-1 rounded">;</code> (punct si virgula).
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <div>
                  <strong>Verifica maparea coloanelor:</strong> Data = coloana 1, Explicatie = coloana 2, Debit = coloana 3, Credit = coloana 4, Document = coloana 5.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <div>
                  <strong>Selecteaza contul bancar</strong> corespunzator din planul de conturi SAGA (ex: 5121 pentru cont curent RON).
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">5</span>
                <div>
                  <strong>Apasa Import</strong> si verifica in SAGA ca soldul final corespunde cu extrasul bancar.
                </div>
              </li>
            </ol>
            <div className="mt-4 p-3 bg-blue-100 rounded-lg text-xs text-blue-800">
              <strong>Nota:</strong> Daca intampini probleme cu caracterele romanesti (ă, î, ș, ț), asigura-te ca ai selectat encoding-ul Windows-1250 la export.
              In versiunile mai noi de SAGA, poti folosi si UTF-8.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRON(n: number): string {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRomanianAmount(n: number): string {
  const fixed = n.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  let formatted = '';
  let count = 0;
  for (let i = intPart.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) formatted = '.' + formatted;
    formatted = intPart[i] + formatted;
    count++;
  }
  return `${formatted},${decPart}`;
}
