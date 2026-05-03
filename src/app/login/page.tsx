'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
   const [showPassword, setShowPassword] = useState(false);
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
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      {/* Sfondo con tema minimale */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.08),transparent_70%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      
      <div className="w-full max-w-md p-8 glass-card border border-zinc-800 rounded-3xl bg-zinc-900/50 backdrop-blur-xl shadow-2xl">
        <div className="text-center mb-8 relative z-10">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 shadow-xl">
              <Image src="/app_icon_512.png" alt="Logo" width={64} height={64} className="rounded-xl" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Accesso</h1>
          <p className="text-zinc-400 mt-2 text-sm font-medium">Autoscuola Toscana</p>
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
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-base text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Password</label>
            <div className="relative group">
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 pr-12 text-base text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                title={showPassword ? "Nascondi password" : "Mostra password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
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
