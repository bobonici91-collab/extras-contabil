'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', companyName: '', cui: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Parolele nu coincid.');
      return;
    }
    if (form.password.length < 8) {
      setError('Parola trebuie sa aiba minim 8 caractere.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          companyName: form.companyName,
          cui: form.cui,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Eroare la inregistrare');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard/upload');
    } catch {
      setError('Eroare de conexiune. Incercati din nou.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">EC</div>
            <span className="text-xl font-bold text-gray-900">ExtrasContabil</span>
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Inregistrare</h1>
          <p className="text-gray-500 text-sm mb-6">3 zile gratuit, fara obligatii</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume Complet</label>
              <input type="text" value={form.name} onChange={e => updateField('name', e.target.value)} required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Ion Popescu" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="email@firma.ro" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numele Firmei de Contabilitate</label>
              <input type="text" value={form.companyName} onChange={e => updateField('companyName', e.target.value)} required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="SC Contabilitate Expert SRL" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CUI Firma</label>
              <input type="text" value={form.cui} onChange={e => updateField('cui', e.target.value)} required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="RO12345678" />
              <p className="text-xs text-gray-400 mt-1">Obligatoriu. Un singur cont per CUI.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parola (minim 8 caractere)</label>
              <input type="password" value={form.password} onChange={e => updateField('password', e.target.value)} required minLength={8}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Parola" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirma Parola</label>
              <input type="password" value={form.confirmPassword} onChange={e => updateField('confirmPassword', e.target.value)} required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Confirma parola" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Se inregistreaza...' : 'Creeaza Cont Gratuit'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Ai deja cont?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">Autentificare</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
