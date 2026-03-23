'use client';

import { useState } from 'react';
import { createUserAction, updateUserAction } from '@/actions/auth';
import { Loader2, UserPlus, Shield, User, Mail, Lock } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface UserFormProps {
  user?: any; // Se presente, siamo in modalità edit
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [role, setRole] = useState<'admin' | 'istruttore' | 'segreteria'>(user?.user_metadata?.role || 'segreteria');

  const isEdit = !!user;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const full_name = formData.get('full_name') as string;

    try {
      let result;
      if (isEdit) {
        result = await updateUserAction(user.id, {
          email,
          full_name,
          role,
          ...(password && { password }) // Password opzionale in edit
        });
      } else {
        result = await createUserAction({ email, password, full_name, role });
      }

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err: any) {
      setError(err?.message || `Errore imprevisto durante la ${isEdit ? 'modifica' : 'creazione'} dell'utente.`);
    } finally {
      setLoading(false);
    }
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
          defaultValue={user?.user_metadata?.full_name || ''}
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
          defaultValue={user?.email || ''}
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
          required={!isEdit}
          minLength={6}
          placeholder={isEdit ? "Cambia password (lascia vuoto per non modificare)" : "••••••••"}
          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1 flex items-center gap-1.5">
          <Shield size={12} /> Ruolo
        </label>
        <CustomSelect
          options={[
            { id: 'segreteria', label: 'Segreteria' },
            { id: 'istruttore', label: 'Istruttore' },
            { id: 'admin', label: 'Amministratore' }
          ]}
          value={role}
          onChange={(val) => setRole(val as any)}
          icon={Shield}
          placeholder="Seleziona ruolo"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold text-center">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center">
          Utente {isEdit ? 'aggiornato' : 'creato'} con successo!
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
              {isEdit ? <Shield size={16} /> : <UserPlus size={16} />}
              {isEdit ? 'Salva Modifiche' : 'Crea Utente'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
