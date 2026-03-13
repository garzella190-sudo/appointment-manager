'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Carica l'email salvata se presente all'avvio
    const savedEmail = localStorage.getItem('autoscuola_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Chiama Supabase per verificare email e password
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Credenziali non valide. Riprova.");
      setLoading(false);
    } else {
      // Salva o rimuove l'email in base al checkbox
      if (rememberMe) {
        localStorage.setItem('autoscuola_remembered_email', email);
      } else {
        localStorage.removeItem('autoscuola_remembered_email');
      }

      // Se è tutto ok, ti spedisce al calendario!
      router.push('/calendar');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md p-8 glass-card border border-zinc-800 rounded-3xl bg-zinc-900/50 backdrop-blur-xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Accesso</h1>
          <p className="text-zinc-400 mt-2 text-sm">Gestionale Autoscuola</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Email</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@autoscuola.it"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded-md border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-zinc-900"
            />
            <label htmlFor="remember" className="text-sm font-medium text-zinc-400 select-none cursor-pointer">
              Ricorda la mia email
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-900/50 rounded-lg text-red-400 text-sm text-center font-medium">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/20"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Accedi al Gestionale'}
          </button>
        </form>
      </div>
    </div>
  );
}
