'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  companyName: string | null;
  createdAt: string;
  subscription: {
    status: string;
    plan: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
  _count: { uploads: number; auditLogs: number };
}

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  trialing: number;
  totalUploads: number;
  estimatedMRR: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        });
        if (res.status === 403) {
          router.push('/dashboard/upload');
          return;
        }
        if (!res.ok) throw new Error('Eroare');
        const data = await res.json();
        setUsers(data.users);
        setStats(data.stats);
      } catch {
        setError('Eroare la incarcarea datelor.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.name || '').toLowerCase().includes(search.toLowerCase())
  );

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      trialing: 'bg-blue-100 text-blue-700',
      past_due: 'bg-yellow-100 text-yellow-700',
      canceled: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      active: 'Activ',
      trialing: 'Proba',
      past_due: 'Restanta',
      canceled: 'Anulat',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {labels[status] || status}
      </span>
    );
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Se incarca...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-red-500">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">EC</div>
          <div>
            <span className="font-bold text-gray-900">ExtrasContabil</span>
            <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">ADMIN</span>
          </div>
        </div>
        <a href="/dashboard/upload" className="text-sm text-gray-500 hover:text-gray-700">Inapoi la aplicatie</a>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <StatCard label="Total Utilizatori" value={String(stats.totalUsers)} color="blue" />
            <StatCard label="Abonamente Active" value={String(stats.activeSubscriptions)} color="green" />
            <StatCard label="Perioada Proba" value={String(stats.trialing)} color="yellow" />
            <StatCard label="Fisiere Procesate" value={String(stats.totalUploads)} color="purple" />
            <StatCard label="MRR Estimat" value={`${(stats.activeSubscriptions * 500).toLocaleString('ro-RO')} RON`} color="green" />
          </div>
        )}

        {/* Users table */}
        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Utilizatori ({filtered.length})</h2>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cauta dupa email, firma..."
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Firma / Utilizator</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Abonament</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Expira</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Fisiere</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Inregistrat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id} className="border-b hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{user.companyName || '—'}</div>
                      <div className="text-xs text-gray-400">{user.name || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      {user.subscription ? statusBadge(user.subscription.status) : (
                        <span className="text-gray-400 text-xs">Fara abonament</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {user.subscription?.currentPeriodEnd
                        ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString('ro-RO')
                        : user.subscription?.trialEndsAt
                        ? `Proba pana la ${new Date(user.subscription.trialEndsAt).toLocaleDateString('ro-RO')}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{user._count.uploads}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(user.createdAt).toLocaleDateString('ro-RO')}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      {search ? 'Niciun utilizator gasit.' : 'Niciun utilizator inregistrat inca.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
