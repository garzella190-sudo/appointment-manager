'use client';

import { useState } from 'react';
import { createUserAction } from '@/actions/auth';
import { Loader2, UserPlus, Shield, User, Mail, Lock } from 'lucide-react';

interface UserFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserForm({ onSuccess, onCancel }: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const full_name = formData.get('full_name') as string;
    const role = formData.get('role') as 'admin' | 'istruttore' | 'segreteria';

    const result = await createUserAction({ email, password, full_name, role });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-1">
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
          <User size={12} /> Nome Completo
        </label>
        <input
          name="full_name"
          type="text"
          required
          placeholder="es. Mario Rossi"
          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
          <Mail size={12} /> Email
        </label>
        <input
          name="email"
          type="email"
          required
          placeholder="email@esempio.it"
          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
          <Lock size={12} /> Password
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="••••••••"
          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
          <Shield size={12} /> Ruolo
        </label>
        <select
          name="role"
          required
          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
        >
          <option value="segreteria">Segreteria</option>
          <option value="istruttore">Istruttore</option>
          <option value="admin">Amministratore</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold text-center">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center">
          Utente creato con successo!
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-5 py-3 rounded-xl font-bold text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={loading || success}
          className="flex-[2] flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <>
              <UserPlus size={16} />
              Crea Utente
            </>
          )}
        </button>
      </div>
    </form>
  );
}
