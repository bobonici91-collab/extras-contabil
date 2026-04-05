'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const BANKS = [
  { id: 'auto', name: 'Detectie Automata' },
  { id: 'bcr', name: 'BCR (Banca Comerciala Romana)' },
  { id: 'brd', name: 'BRD (Groupe Societe Generale)' },
  { id: 'bt', name: 'Banca Transilvania' },
  { id: 'ing', name: 'ING Bank Romania' },
  { id: 'raiffeisen', name: 'Raiffeisen Bank' },
  { id: 'cec', name: 'CEC Bank' },
  { id: 'unicredit', name: 'UniCredit Bank' },
  { id: 'otp', name: 'OTP Bank Romania' },
  { id: 'alpha', name: 'Alpha Bank Romania' },
  { id: 'mt940', name: 'Format MT940 (SWIFT)' },
  { id: 'camt053', name: 'Format CAMT.053 (ISO 20022)' },
];

export default function UploadPage() {
  const router = useRouter();
  const [selectedBank, setSelectedBank] = useState('auto');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
      setError('');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  }, []);

  async function handleUpload() {
    if (!file) return;
    setError('');
    setUploading(true);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bankId', selectedBank === 'auto' ? '' : selectedBank);

      setProgress(30);

      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: formData,
      });

      setProgress(70);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Eroare la procesarea fisierului');
        return;
      }

      setProgress(100);

      // Store parse result in sessionStorage for preview page
      sessionStorage.setItem('parseResult', JSON.stringify(data));

      // Navigate to preview
      setTimeout(() => router.push('/dashboard/preview'), 500);
    } catch {
      setError('Eroare de conexiune. Incercati din nou.');
    } finally {
      setUploading(false);
    }
  }

  const acceptedFormats = '.csv,.txt,.sta,.mt940,.xml';

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Incarca Extras de Cont</h1>
      <p className="text-gray-500 mb-8">Selecteaza banca si incarca fisierul cu extrasul bancar</p>

      {/* Bank selector */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Selecteaza Banca</label>
        <select
          value={selectedBank}
          onChange={e => setSelectedBank(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
        >
          {BANKS.map(bank => (
            <option key={bank.id} value={bank.id}>{bank.name}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-2">
          Selecteaza &quot;Detectie Automata&quot; daca nu esti sigur. Aplicatia va identifica formatul automat.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`bg-white rounded-xl border-2 border-dashed p-12 text-center transition cursor-pointer ${
          dragActive ? 'border-blue-500 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        <input
          id="fileInput"
          type="file"
          accept={acceptedFormats}
          onChange={handleFileSelect}
          className="hidden"
        />

        {file ? (
          <div>
            <div className="text-4xl mb-4">{'\u2705'}</div>
            <p className="text-lg font-medium text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              {(file.size / 1024).toFixed(1)} KB &bull; Click pentru a schimba fisierul
            </p>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-4">{'\u{1F4C2}'}</div>
            <p className="text-lg font-medium text-gray-900">Trage fisierul aici</p>
            <p className="text-sm text-gray-500 mt-1">sau click pentru a selecta</p>
            <p className="text-xs text-gray-400 mt-3">
              Formate acceptate: CSV, MT940 (.sta), CAMT.053 (.xml), TXT
            </p>
          </div>
        )}
      </div>

      {/* Progress */}
      {uploading && (
        <div className="mt-6 bg-white rounded-xl border p-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Se proceseaza fisierul...</span>
            <span className="text-blue-600 font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {progress < 30 ? 'Se incarca fisierul...' :
             progress < 70 ? 'Se parseaza tranzactiile...' :
             progress < 100 ? 'Se valideaza datele...' :
             'Finalizat!'}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Upload button */}
      {file && !uploading && (
        <button
          onClick={handleUpload}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-medium text-lg hover:bg-blue-700 transition"
        >
          Proceseaza Extrasul
        </button>
      )}

      {/* Info */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6 border border-blue-100">
        <h3 className="font-bold text-blue-900 mb-3">Cum functioneaza?</h3>
        <ol className="space-y-2 text-sm text-blue-800">
          <li>1. Selecteaza banca de la care provine extrasul (sau lasa detectia automata)</li>
          <li>2. Incarca fisierul CSV, MT940 sau CAMT.053</li>
          <li>3. Aplicatia parseaza si valideaza automat tranzactiile</li>
          <li>4. Verifica si editeaza tranzactiile in previzualizare</li>
          <li>5. Exporta fisierul compatibil SAGA</li>
        </ol>
      </div>
    </div>
  );
}
