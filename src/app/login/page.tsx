'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Credenziali non valide o errore di sistema.");
      setLoading(false);
    } else {
      router.push('/calendar');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md p-8 glass-card border border-zinc-800 rounded-3xl bg-zinc-900/50 backdrop-blur-xl">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Accesso Gestionale</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase ml-1">Email</label>
            <input 
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800/50 border-zinc-700/50 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 placeholder-zinc-500"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase ml-1">Password</label>
            <input 
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-800/50 border-zinc-700/50 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button 
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? 'Verifica in corso...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}
