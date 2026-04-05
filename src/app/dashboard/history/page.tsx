'use client';

import { useState } from 'react';

interface HistoryEntry {
  id: string;
  date: string;
  bankName: string;
  fileName: string;
  transactionCount: number;
  totalDebit: number;
  totalCredit: number;
  status: 'exported' | 'parsed' | 'error';
}

export default function HistoryPage() {
  // In production, this would fetch from API
  const [history] = useState<HistoryEntry[]>([]);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Istoric Conversii</h1>
      <p className="text-gray-500 mb-8">Toate extrasele procesate si exportate</p>

      {history.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-4xl mb-4">{'\u{1F4CB}'}</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Niciun extras procesat inca</h3>
          <p className="text-gray-500 text-sm mb-4">
            Istoricul conversiilor tale va aparea aici dupa ce incarci si exporti primul extras de cont.
          </p>
          <a href="/dashboard/upload" className="text-blue-600 font-medium hover:text-blue-700">
            Incarca primul extras
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full data-table text-sm">
            <thead>
              <tr>
                <th>Data</th>
                <th>Banca</th>
                <th>Fisier</th>
                <th className="text-right">Tranzactii</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.date}</td>
                  <td>{entry.bankName}</td>
                  <td className="max-w-xs truncate">{entry.fileName}</td>
                  <td className="text-right">{entry.transactionCount}</td>
                  <td className="text-right text-red-600 font-mono">
                    {entry.totalDebit.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right text-green-600 font-mono">
                    {entry.totalCredit.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      entry.status === 'exported' ? 'bg-green-100 text-green-700' :
                      entry.status === 'parsed' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {entry.status === 'exported' ? 'Exportat' : entry.status === 'parsed' ? 'Procesat' : 'Eroare'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
