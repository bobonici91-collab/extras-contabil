'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface Transaction {
  date: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
  reference: string;
  counterparty: string;
  balance: number | null;
  lineNumber: number;
}

interface ValidationMsg {
  code: string;
  message: string;
  lineNumber?: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

interface ValidationLayer {
  layer: string;
  passed: boolean;
  hasBlockingErrors: boolean;
  messages: ValidationMsg[];
  score: number;
}

interface ParseData {
  parseResult: {
    success: boolean;
    transactions: Transaction[];
    metadata: {
      bank: string;
      bankName: string;
      totalDebit: number;
      totalCredit: number;
      transactionCount: number;
      dateRange: { from: string; to: string } | null;
      openingBalance: number | null;
      closingBalance: number | null;
    };
    confidence: number;
  };
  validation: {
    layers: ValidationLayer[];
    overallScore: number;
    canExport: boolean;
    summary: string;
  };
}

const LAYER_NAMES: Record<string, string> = {
  structural: 'Structurala',
  encoding: 'Codificare',
  semantic: 'Semantica',
  financial: 'Financiara',
  'cross-check': 'Verificari Incrucisate',
};

export default function PreviewPage() {
  const router = useRouter();
  const [data, setData] = useState<ParseData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Transaction | null>(null);
  const [showValidation, setShowValidation] = useState(true);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  useEffect(() => {
    const stored = sessionStorage.getItem('parseResult');
    if (stored) {
      const parsed = JSON.parse(stored) as ParseData;
      setData(parsed);
      setTransactions(parsed.parseResult.transactions);
    }
  }, []);

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(tx =>
        tx.description.toLowerCase().includes(term) ||
        tx.reference.toLowerCase().includes(term) ||
        tx.counterparty.toLowerCase().includes(term)
      );
    }

    if (sortColumn) {
      result.sort((a, b) => {
        const valA = a[sortColumn as keyof Transaction];
        const valB = b[sortColumn as keyof Transaction];
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [transactions, searchTerm, sortColumn, sortAsc]);

  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);
  const pageTransactions = filteredTransactions.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const totals = useMemo(() => ({
    debit: Math.round(transactions.reduce((s, t) => s + t.debit, 0) * 100) / 100,
    credit: Math.round(transactions.reduce((s, t) => s + t.credit, 0) * 100) / 100,
  }), [transactions]);

  function handleSort(col: string) {
    if (sortColumn === col) setSortAsc(!sortAsc);
    else { setSortColumn(col); setSortAsc(true); }
  }

  function startEdit(tx: Transaction, index: number) {
    setEditingRow(index);
    setEditForm({ ...tx });
  }

  function saveEdit() {
    if (editForm && editingRow !== null) {
      setTransactions(prev => {
        const updated = [...prev];
        const idx = prev.findIndex(t => t.lineNumber === editForm.lineNumber);
        if (idx !== -1) updated[idx] = editForm;
        return updated;
      });
      setEditingRow(null);
      setEditForm(null);
    }
  }

  function deleteTransaction(lineNumber: number) {
    setTransactions(prev => prev.filter(t => t.lineNumber !== lineNumber));
  }

  function handleExport() {
    // Update sessionStorage with edited transactions
    if (data) {
      const updated = {
        ...data,
        parseResult: { ...data.parseResult, transactions }
      };
      sessionStorage.setItem('parseResult', JSON.stringify(updated));
    }
    router.push('/dashboard/export');
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20">
        <p className="text-gray-500 text-lg mb-4">Nu exista date de previzualizat.</p>
        <button onClick={() => router.push('/dashboard/upload')} className="text-blue-600 font-medium hover:text-blue-700">
          Incarca un extras de cont
        </button>
      </div>
    );
  }

  const { parseResult, validation } = data;

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Previzualizare Tranzactii</h1>
          <p className="text-gray-500 text-sm mt-1">
            {parseResult.metadata.bankName} &bull; {transactions.length} tranzactii
            {parseResult.metadata.dateRange && (
              <> &bull; {parseResult.metadata.dateRange.from} - {parseResult.metadata.dateRange.to}</>
            )}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={!validation.canExport}
          className={`px-6 py-2.5 rounded-lg font-medium transition ${
            validation.canExport
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Export SAGA
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Debit" value={formatRON(totals.debit)} color="red" />
        <SummaryCard label="Total Credit" value={formatRON(totals.credit)} color="green" />
        <SummaryCard label="Scor Validare" value={`${validation.overallScore}/100`}
          color={validation.overallScore >= 80 ? 'green' : validation.overallScore >= 50 ? 'yellow' : 'red'} />
        <SummaryCard label="Tranzactii" value={String(transactions.length)} color="blue" />
      </div>

      {/* Validation panel */}
      <div className="mb-6">
        <button
          onClick={() => setShowValidation(!showValidation)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3"
        >
          <span>{showValidation ? '\u25BC' : '\u25B6'}</span>
          Rezultate Validare — {validation.summary}
        </button>

        {showValidation && (
          <div className="bg-white rounded-xl border p-4 space-y-3 animate-fade-in">
            {validation.layers.map(layer => (
              <div key={layer.layer} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${layer.passed ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium text-sm">{LAYER_NAMES[layer.layer] || layer.layer}</span>
                  </div>
                  <span className="text-xs text-gray-500">{layer.score}/100</span>
                </div>
                {layer.messages.filter(m => m.severity !== 'info').map((msg, i) => (
                  <div key={i} className={`text-xs px-2 py-1 rounded mb-1 ${
                    msg.severity === 'critical' ? 'bg-red-50 text-red-700' :
                    msg.severity === 'error' ? 'bg-red-50 text-red-600' :
                    msg.severity === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {msg.message}
                  </div>
                ))}
                {layer.messages.filter(m => m.severity !== 'info').length === 0 && (
                  <p className="text-xs text-green-600">Toate verificarile au trecut.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          placeholder="Cauta in descriere, referinta sau contrapartida..."
          className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Transaction table */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full data-table text-sm">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th className="cursor-pointer hover:bg-gray-100 w-28" onClick={() => handleSort('date')}>
                Data {sortColumn === 'date' && (sortAsc ? '\u2191' : '\u2193')}
              </th>
              <th className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('description')}>
                Descriere {sortColumn === 'description' && (sortAsc ? '\u2191' : '\u2193')}
              </th>
              <th className="cursor-pointer hover:bg-gray-100 text-right w-32" onClick={() => handleSort('debit')}>
                Debit {sortColumn === 'debit' && (sortAsc ? '\u2191' : '\u2193')}
              </th>
              <th className="cursor-pointer hover:bg-gray-100 text-right w-32" onClick={() => handleSort('credit')}>
                Credit {sortColumn === 'credit' && (sortAsc ? '\u2191' : '\u2193')}
              </th>
              <th className="w-24">Referinta</th>
              <th className="w-20">Actiuni</th>
            </tr>
          </thead>
          <tbody>
            {pageTransactions.map((tx, idx) => (
              editingRow === idx ? (
                <tr key={tx.lineNumber} className="bg-blue-50">
                  <td className="text-gray-400">{tx.lineNumber}</td>
                  <td>
                    <input type="text" value={editForm?.date || ''} onChange={e => setEditForm(prev => prev ? {...prev, date: e.target.value} : null)}
                      className="w-full px-2 py-1 border rounded text-xs" />
                  </td>
                  <td>
                    <input type="text" value={editForm?.description || ''} onChange={e => setEditForm(prev => prev ? {...prev, description: e.target.value} : null)}
                      className="w-full px-2 py-1 border rounded text-xs" />
                  </td>
                  <td>
                    <input type="number" step="0.01" value={editForm?.debit || 0} onChange={e => setEditForm(prev => prev ? {...prev, debit: parseFloat(e.target.value) || 0} : null)}
                      className="w-full px-2 py-1 border rounded text-xs text-right" />
                  </td>
                  <td>
                    <input type="number" step="0.01" value={editForm?.credit || 0} onChange={e => setEditForm(prev => prev ? {...prev, credit: parseFloat(e.target.value) || 0} : null)}
                      className="w-full px-2 py-1 border rounded text-xs text-right" />
                  </td>
                  <td>
                    <input type="text" value={editForm?.reference || ''} onChange={e => setEditForm(prev => prev ? {...prev, reference: e.target.value} : null)}
                      className="w-full px-2 py-1 border rounded text-xs" />
                  </td>
                  <td className="flex gap-1">
                    <button onClick={saveEdit} className="text-green-600 hover:text-green-800 text-xs font-medium">Salv</button>
                    <button onClick={() => { setEditingRow(null); setEditForm(null); }} className="text-gray-400 hover:text-gray-600 text-xs">Anul</button>
                  </td>
                </tr>
              ) : (
                <tr key={tx.lineNumber}>
                  <td className="text-gray-400">{tx.lineNumber}</td>
                  <td className="whitespace-nowrap">{tx.date}</td>
                  <td className="max-w-xs truncate" title={tx.description}>{tx.description}</td>
                  <td className="text-right text-red-600 font-mono">{tx.debit > 0 ? formatRON(tx.debit) : ''}</td>
                  <td className="text-right text-green-600 font-mono">{tx.credit > 0 ? formatRON(tx.credit) : ''}</td>
                  <td className="text-gray-500 text-xs">{tx.reference}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(tx, idx)} className="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                      <button onClick={() => deleteTransaction(tx.lineNumber)} className="text-red-400 hover:text-red-600 text-xs">X</button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-gray-50">
              <td colSpan={3} className="text-right">TOTAL:</td>
              <td className="text-right text-red-600 font-mono">{formatRON(totals.debit)}</td>
              <td className="text-right text-green-600 font-mono">{formatRON(totals.credit)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Pagina {currentPage} din {totalPages} ({filteredTransactions.length} tranzactii)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Urmator
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-50 border-red-200 text-red-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

function formatRON(n: number): string {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
