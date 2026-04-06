'use client';

import { useState } from 'react';

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert('Eroare la redirectionarea catre pagina de plata.');
    } finally {
      setLoading(false);
    }
  }

  async function handleManage() {
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert('Eroare la deschiderea portalului de facturare.');
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Abonament</h1>
      <p className="text-gray-500 mb-8">Gestioneaza abonamentul firmei tale de contabilitate</p>

      {/* Current plan */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Plan Curent</h2>
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
            Perioada de Proba
          </span>
        </div>
        <p className="text-gray-600 text-sm mb-4">
          Beneficiezi de acces la functiile aplicatiei pentru 3 zile (max 3 fisiere).
        </p>
        <button
          onClick={handleManage}
          className="text-blue-600 font-medium text-sm hover:text-blue-700"
        >
          Gestioneaza abonament
        </button>
      </div>

      {/* Plan details */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl">
        <div className="text-center mb-6">
          <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">Plan Standard</span>
        </div>
        <div className="text-center mb-8">
          <span className="text-5xl font-bold">500</span>
          <span className="text-xl ml-1">RON</span>
          <span className="text-blue-200 block text-sm mt-1">/ luna / firma de contabilitate</span>
        </div>

        <ul className="space-y-3 mb-8">
          {[
            'Fisiere nelimitate — fara restrictii de numar',
            'Toate cele 9 banci romanesti suportate',
            'Formate: CSV, MT940, CAMT.053 (XML)',
            'Export SAGA nelimitat',
            'Asistent AI integrat',
            'Validare avansata cu reconciliere sold',
            'Criptare AES-256 si securitate maxima',
            'Stergere automata date la 24h',
            'Suport prioritar',
          ].map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-green-300 mt-0.5">&#10003;</span>
              <span className="text-blue-100 text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="block w-full bg-white text-blue-700 text-center py-3 rounded-lg font-bold text-lg hover:bg-blue-50 transition disabled:opacity-50"
        >
          {loading ? 'Se redirectioneaza...' : 'Activeaza Abonament'}
        </button>
      </div>

      {/* FAQ */}
      <div className="mt-8 space-y-4">
        <h3 className="font-bold text-gray-900">Intrebari Frecvente</h3>

        <details className="bg-white rounded-xl border p-4">
          <summary className="cursor-pointer font-medium text-gray-900 text-sm">Exista un numar maxim de fisiere?</summary>
          <p className="text-gray-600 text-sm mt-2">Nu. Abonamentul include fisiere nelimitate, fara niciun plafon de incarcare sau export.</p>
        </details>

        <details className="bg-white rounded-xl border p-4">
          <summary className="cursor-pointer font-medium text-gray-900 text-sm">Pot folosi mai multi utilizatori pe acelasi cont?</summary>
          <p className="text-gray-600 text-sm mt-2">Abonamentul este per firma de contabilitate. Toti angajatii firmei pot folosi aplicatia.</p>
        </details>

        <details className="bg-white rounded-xl border p-4">
          <summary className="cursor-pointer font-medium text-gray-900 text-sm">Cum pot anula abonamentul?</summary>
          <p className="text-gray-600 text-sm mt-2">Poti anula oricand din pagina de gestionare abonament. Vei avea acces pana la sfarsitul perioadei platite.</p>
        </details>

        <details className="bg-white rounded-xl border p-4">
          <summary className="cursor-pointer font-medium text-gray-900 text-sm">Se emit facturi fiscale?</summary>
          <p className="text-gray-600 text-sm mt-2">Da. Facturile sunt generate automat de Stripe si sunt disponibile in portalul de facturare.</p>
        </details>
      </div>
    </div>
  );
}
