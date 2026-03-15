'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Phone, Mail, Trash2, AlertCircle } from 'lucide-react';
import { TipoPatente } from '@/lib/database.types';
import { 
  createIstruttoreAction, 
  updateIstruttoreAction, 
  deleteIstruttoreAction 
} from '@/actions/istruttori';

const ALL_PATENTI: TipoPatente[] = ['AM', 'A1', 'A2', 'A', 'B1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'];

interface IstruttoreFormProps {
  istruttoreId?: string;
  defaultValues?: {
    nome: string;
    cognome: string;
    telefono: string;
    email: string;
    patenti_abilitate: TipoPatente[];
    colore?: string;
    default_vehicle_id?: string | null;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

const INPUT_CLS = 'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm h-11';
const LABEL_CLS = 'text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide';

export const IstruttoreForm = ({
  istruttoreId,
  defaultValues,
  onSuccess,
  onCancel,
}: IstruttoreFormProps) => {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<{id: string, nome: string, targa: string}[]>([]);

  const capitalizeWords = (str: string) => {
    if (!str) return '';
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const [form, setForm] = useState({
    nome: capitalizeWords(defaultValues?.nome ?? ''),
    cognome: capitalizeWords(defaultValues?.cognome ?? ''),
    telefono: defaultValues?.telefono ?? '',
    email: defaultValues?.email ?? '',
    patenti_abilitate: (defaultValues?.patenti_abilitate || []) as TipoPatente[],
    colore: defaultValues?.colore ?? defaultValues?.colore ?? '#3B82F6',
    default_vehicle_id: defaultValues?.default_vehicle_id ?? null,
  });
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVehicles() {
      const { data } = await supabase.from('veicoli').select('id, nome, targa').order('nome');
      if (data) setVehicles(data);
    }
    fetchVehicles();
  }, []);

  useEffect(() => {
    setForm({
      nome: capitalizeWords(defaultValues?.nome ?? ''),
      cognome: capitalizeWords(defaultValues?.cognome ?? ''),
      telefono: defaultValues?.telefono ?? '',
      email: defaultValues?.email ?? '',
      patenti_abilitate: (defaultValues?.patenti_abilitate || []) as TipoPatente[],
      colore: defaultValues?.colore ?? '#3B82F6',
      default_vehicle_id: defaultValues?.default_vehicle_id ?? null,
    });
  }, [JSON.stringify(defaultValues)]);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value || (key === 'default_vehicle_id' ? null : '') }));

  const togglePatente = (tipo: TipoPatente) => {
    setForm(prev => ({
      ...prev,
      patenti_abilitate: prev.patenti_abilitate.includes(tipo)
        ? prev.patenti_abilitate.filter(p => p !== tipo)
        : [...prev.patenti_abilitate, tipo],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setServerError(null);

    const payload = {
      nome: form.nome,
      cognome: form.cognome,
      telefono: form.telefono || null,
      email: form.email || null,
      patenti_abilitate: form.patenti_abilitate,
      colore: form.colore,
      default_vehicle_id: form.default_vehicle_id || null,
    };

    const result = istruttoreId
      ? await updateIstruttoreAction(istruttoreId, payload)
      : await createIstruttoreAction(payload);

    setLoading(false);
    
    if (result.success) {
      onSuccess();
    } else {
      setServerError(result.error || 'Si è verificato un errore nel salvataggio.');
    }
  };

  const handleDelete = async () => {
    if (!istruttoreId) return;
    if (!window.confirm("Sei sicuro di voler eliminare questo istruttore? L'azione è irreversibile.")) return;

    setLoading(true);
    const result = await deleteIstruttoreAction(istruttoreId);
    setLoading(false);

    if (result.success) {
      onSuccess();
    } else {
      setServerError(result.error || "Errore durante l'eliminazione.");
    }
  };

  // Calcola se i dati sono stati modificati rispetto agli originali
  const isDirty = 
    form.nome !== (defaultValues?.nome ?? '') ||
    form.cognome !== (defaultValues?.cognome ?? '') ||
    form.telefono !== (defaultValues?.telefono ?? '') ||
    form.email !== (defaultValues?.email ?? '') ||
    form.colore !== (defaultValues?.colore ?? '#3B82F6') ||
    form.default_vehicle_id !== (defaultValues?.default_vehicle_id ?? null) ||
    JSON.stringify(form.patenti_abilitate) !== JSON.stringify(defaultValues?.patenti_abilitate ?? []);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {serverError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle size={18} className="shrink-0" />
          <p className="font-medium">{serverError}</p>
        </div>
      )}
      {/* Cognome & Nome */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Cognome</label>
          <input 
            required 
            value={form.cognome} 
            onChange={(e) => setForm(prev => ({ ...prev, cognome: capitalizeWords(e.target.value) }))} 
            className={INPUT_CLS} 
            placeholder="Rossi" 
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Nome</label>
          <input 
            required 
            value={form.nome} 
            onChange={(e) => setForm(prev => ({ ...prev, nome: capitalizeWords(e.target.value) }))} 
            className={INPUT_CLS} 
            placeholder="Mario" 
          />
        </div>
      </div>

      {/* Telefono */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Telefono</label>
        <div className="flex items-center gap-2">
          <input value={form.telefono} onChange={set('telefono')} className={INPUT_CLS} placeholder="333 1234567" type="tel" />
          {form.telefono && (
            <a
              href={`tel:${form.telefono.replace(/\s/g, '')}`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-sm font-semibold hover:bg-green-100 transition-colors"
            >
              <Phone size={14} />
            </a>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Email</label>
        <div className="flex items-center gap-2">
          <input value={form.email} onChange={set('email')} className={INPUT_CLS} placeholder="mario@email.it" type="email" />
          {form.email && (
            <a
              href={`mailto:${form.email}`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors"
            >
              <Mail size={14} />
            </a>
          )}
        </div>
      </div>

      {/* Patenti abilitate */}
      <div className="space-y-2">
        <label className={LABEL_CLS}>Patenti Abilitate</label>
        <div className="flex flex-wrap gap-2">
          {ALL_PATENTI.map(tipo => {
            const active = form.patenti_abilitate.includes(tipo);
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => togglePatente(tipo)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-transparent hover:border-zinc-300'
                }`}
              >
                {tipo}
              </button>
            );
          })}
        </div>
        {form.patenti_abilitate.length === 0 && (
          <p className="text-xs text-amber-500">Seleziona almeno una patente</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Colore Identificativo</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.colore}
            onChange={set('colore' as any)}
            className="w-12 h-10 p-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer"
          />
          <span className="text-sm font-mono text-zinc-500 uppercase">{form.colore}</span>
        </div>
      </div>

      {/* Veicolo Predefinito */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Veicolo Predefinito (Patente B)</label>
        <select 
          value={form.default_vehicle_id || ''} 
          onChange={set('default_vehicle_id')} 
          className={INPUT_CLS}
        >
          <option value="">Nessuno</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.nome} ({v.targa})</option>
          ))}
        </select>
      </div>

      {/* Actions */}
      {!istruttoreId ? (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm"
          >
            Annulla
          </button>
          <button
            disabled={loading || form.patenti_abilitate.length === 0}
            type="submit"
            className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Crea Istruttore'}
          </button>
        </div>
      ) : isDirty ? (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setForm({
                nome: capitalizeWords(defaultValues?.nome ?? ''),
                cognome: capitalizeWords(defaultValues?.cognome ?? ''),
                telefono: defaultValues?.telefono ?? '',
                email: defaultValues?.email ?? '',
                patenti_abilitate: defaultValues?.patenti_abilitate ?? [],
                colore: defaultValues?.colore ?? '#3B82F6',
                default_vehicle_id: defaultValues?.default_vehicle_id ?? null
              });
            }}
            className="flex-1 py-3 rounded-xl font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm"
          >
            Annulla
          </button>
          <button
            disabled={loading || form.patenti_abilitate.length === 0}
            type="submit"
            className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Aggiorna anagrafica'}
          </button>
        </div>
      ) : null}

      {istruttoreId && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="w-full mt-3 py-3 rounded-xl font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-sm flex items-center justify-center gap-2"
        >
          <Trash2 size={16} />
          Elimina Istruttore
        </button>
      )}
    </form>
  );
};
