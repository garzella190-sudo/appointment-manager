'use client';

import { useState } from 'react';
import { createUserAction, updateUserAction, deleteUserAction } from '@/actions/auth';
import { Loader2, UserPlus, Shield, User, Mail, Lock, Trash2, Plus } from 'lucide-react';
import Select from './Select';
import { ConfirmBubble } from '../ConfirmBubble';
import { cn } from '@/lib/utils';

interface UserFormProps {
  user?: any;
  isAdmin?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

import { Check, ShieldCheck, Settings2, Calendar, Users, GraduationCap, LayoutDashboard, FileText, ChevronDown } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();

const PERMISSION_CATEGORIES = [
  { 
    id: 'core', 
    label: 'Accesso Base', 
    icon: LayoutDashboard,
    permissions: [
      { id: 'access_calendar', label: 'Calendario', desc: 'Visualizza e naviga l\'agenda' },
      { id: 'access_clients', label: 'Anagrafica Clienti', desc: 'Ricerca e visualizza schede' },
      { id: 'access_exams', label: 'Area Esami', desc: 'Visualizza sessioni di esame' },
    ]
  },
  { 
    id: 'edit', 
    label: 'Modifiche & CRUD', 
    icon: Settings2,
    permissions: [
      { id: 'edit_appointments', label: 'Gestione Guide', desc: 'Crea, sposta o elimina guide' },
      { id: 'edit_clients', label: 'Modifica Anagrafiche', desc: 'Aggiorna dati e scadenze allievi' },
      { id: 'manage_exams', label: 'Amministra Esami', desc: 'Crea sessioni e inserisci esiti' },
    ]
  },
  { 
    id: 'admin', 
    label: 'Amministrazione', 
    icon: ShieldCheck,
    permissions: [
      { id: 'access_gestione', label: 'Pannello Gestione', desc: 'Accesso all\'area amministrativa' },
      { id: 'manage_staff', label: 'Gestione Staff', desc: 'Modifica istruttori e veicoli' },
      { id: 'view_reports', label: 'Report Finanziari', desc: 'Visualizza incassi e statistiche' },
      { id: 'manage_users', label: 'Gestione Permessi', desc: 'Modifica utenti e password' },
    ]
  }
];

interface UserFormProps {
  user?: any;
  isAdmin?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserForm({ user, isAdmin, onSuccess, onCancel }: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [role, setRole] = useState<'admin' | 'istruttore' | 'segreteria'>(user?.user_metadata?.role || 'segreteria');
  const [permissions, setPermissions] = useState<Record<string, boolean>>(user?.user_metadata?.permissions || {});
  const [showPermissions, setShowPermissions] = useState(!!user);
  const [istruttori, setIstruttori] = useState<any[]>([]);
  const [selectedIstruttoreId, setSelectedIstruttoreId] = useState<string>(user?.user_metadata?.istruttore_id || '');

  useState(() => {
    async function loadIstruttori() {
      const { data } = await supabase.from('istruttori').select('id, nome, cognome').order('cognome');
      if (data) setIstruttori(data);
    }
    loadIstruttori();
  });

  const isEdit = !!user;

  const togglePermission = (id: string) => {
    setPermissions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const setRoleDefaults = (newRole: string) => {
    setRole(newRole as any);
    let defaults: Record<string, boolean> = {};
    if (newRole === 'admin') {
      PERMISSION_CATEGORIES.forEach(c => c.permissions.forEach(p => defaults[p.id] = true));
    } else if (newRole === 'segreteria') {
      defaults = {
        access_calendar: true,
        access_clients: true,
        access_exams: true,
        edit_appointments: true,
        edit_clients: true,
        manage_exams: true,
        access_gestione: true,
      };
    } else {
      defaults = {
        access_calendar: true,
        access_clients: true,
        access_exams: true,
      };
    }
    setPermissions(defaults);
  };

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
          permissions,
          istruttore_id: role === 'istruttore' ? selectedIstruttoreId : null,
          ...(password && { password })
        });
      } else {
        result = await createUserAction({ 
          email, 
          password, 
          full_name, 
          role,
          permissions
        });
      }

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(onSuccess, 1500);
      }
    } catch (err: any) {
      setError(err?.message || "Errore durante il salvataggio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[75vh] overflow-y-auto no-scrollbar px-1 pb-4">
      {/* Informazioni Base */}
      <div className="bg-white dark:bg-zinc-900/50 p-5 rounded-[24px] border border-zinc-100 dark:border-zinc-800 space-y-4 shadow-sm">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Anagrafica</label>
          <div className="grid grid-cols-1 gap-3">
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                name="full_name"
                type="text"
                required
                placeholder="Nome e Cognome"
                defaultValue={user?.user_metadata?.full_name || ''}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                name="email"
                type="email"
                required
                placeholder="Email di accesso"
                defaultValue={user?.email || ''}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                name="password"
                type="password"
                required={!isEdit}
                minLength={6}
                placeholder={isEdit ? "Modifica Password (opzionale)" : "Password di primo accesso"}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Ruolo & Associazione</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              options={[
                { id: 'segreteria', label: 'Segreteria' },
                { id: 'istruttore', label: 'Istruttore' },
                { id: 'admin', label: 'Amministratore' }
              ]}
              value={role}
              onChange={setRoleDefaults}
              icon={ShieldCheck}
              placeholder="Ruolo"
            />
            {role === 'istruttore' && (
              <Select
                options={istruttori.map(i => ({ id: i.id, label: `${i.cognome} ${i.nome}` }))}
                value={selectedIstruttoreId}
                onChange={setSelectedIstruttoreId}
                icon={Users}
                placeholder="Associa a..."
                searchable
              />
            )}
          </div>
        </div>
      </div>

      {/* Pannello Permessi */}
      <div className="bg-white dark:bg-zinc-900/50 p-5 rounded-[24px] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPermissions(!showPermissions)}
          className="w-full flex items-center justify-between mb-4 group"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-blue-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">Permessi Dettagliati</h3>
          </div>
          <ChevronDown size={18} className={cn("text-zinc-400 transition-transform", showPermissions && "rotate-180")} />
        </button>

        {showPermissions && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            {PERMISSION_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.id} className="space-y-2.5">
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <Icon size={14} className="text-zinc-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{cat.label}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {cat.permissions.map((p) => (
                      <label 
                        key={p.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer group",
                          permissions[p.id] 
                            ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30" 
                            : "bg-zinc-50 dark:bg-zinc-800/20 border-zinc-100 dark:border-zinc-800/50 hover:border-zinc-300"
                        )}
                      >
                        <div className="relative flex items-center justify-center">
                          <input 
                            type="checkbox"
                            checked={!!permissions[p.id]}
                            onChange={() => togglePermission(p.id)}
                            className="peer h-5 w-5 appearance-none rounded-lg border-2 border-zinc-200 dark:border-zinc-700 checked:border-blue-500 checked:bg-blue-500 transition-all cursor-pointer"
                          />
                          <Check size={12} strokeWidth={4} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex-1">
                          <p className={cn(
                            "text-xs font-bold transition-colors",
                            permissions[p.id] ? "text-blue-900 dark:text-blue-100" : "text-zinc-700 dark:text-zinc-200"
                          )}>
                            {p.label}
                          </p>
                          <p className="text-[9px] text-zinc-400 font-medium">{p.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold text-center animate-shake">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {isEdit && isAdmin && (
          <ConfirmBubble
            title="Elimina Utente"
            message={`L'eliminazione di ${user?.user_metadata?.full_name || 'questo utente'} è definitiva.`}
            confirmLabel="Elimina"
            onConfirm={async () => {
              setLoading(true);
              const result = await deleteUserAction(user.id);
              if (result.success) {
                setSuccess(true);
                setTimeout(onSuccess, 1000);
              } else {
                setError(result.error || "Errore durante l'eliminazione.");
                setLoading(false);
              }
            }}
            trigger={
              <button
                type="button"
                disabled={loading}
                className="w-14 h-14 flex items-center justify-center bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all border border-red-100 shrink-0"
              >
                <Trash2 size={20} />
              </button>
            }
          />
        )}
        
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-zinc-200 dark:border-zinc-800"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={loading || success}
          className="flex-[2] h-14 bg-zinc-900 dark:bg-sky-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-zinc-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : (isEdit ? 'Aggiorna Permessi' : 'Crea Account')}
        </button>
      </div>
    </form>
  );
}
