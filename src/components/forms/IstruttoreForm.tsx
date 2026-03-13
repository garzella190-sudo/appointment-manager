'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Phone, Mail } from 'lucide-react';
import { TipoPatente } from '@/lib/database.types';

const ALL_PATENTI: TipoPatente[] = ['AM', 'A1', 'A2', 'A', 'B1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'];

interface IstruttoreFormProps {
  istruttoreId?: string;
  defaultValues?: {
    nome: string;
    cognome: string;
    telefono: string;
    email: string;
    patenti_abilitate: TipoPatente[];
  };
  onSuccess: () => void;
  onCancel: () => void;
}

const INPUT_CLS = 'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm';
const LABEL_CLS = 'text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide';

export const IstruttoreForm = ({
  istruttoreId,
  defaultValues,
  onSuccess,
  onCancel,
}: IstruttoreFormProps) => {
  const [loading, setLoading] = useState(false);
  const capitalizeWords = (str: string) => {
    if (!str) return '';
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const [form, setForm] = useState({
    nome: capitalizeWords(defaultValues?.nome ?? ''),
    cognome: capitalizeWords(defaultValues?.cognome ?? ''),
    telefono: defaultValues?.telefono ?? '',
    email: defaultValues?.email ?? '',
    patenti_abilitate: defaultValues?.patenti_abilitate ?? [] as TipoPatente[],
  });

  useEffect(() => {
    setForm({
      nome: capitalizeWords(defaultValues?.nome ?? ''),
      cognome: capitalizeWords(defaultValues?.cognome ?? ''),
      telefono: defaultValues?.telefono ?? '',
      email: defaultValues?.email ?? '',
      patenti_abilitate: defaultValues?.patenti_abilitate ?? [] as TipoPatente[],
    });
  }, [JSON.stringify(defaultValues)]);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

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

    const payload = {
      nome: form.nome,
      cognome: form.cognome,
      telefono: form.telefono || null,
      email: form.email || null,
      patenti_abilitate: form.patenti_abilitate,
    };

    const { error } = istruttoreId
      ? await supabase.from('istruttori').update(payload).eq('id', istruttoreId)
      : await supabase.from('istruttori').insert(payload);

    setLoading(false);
    if (error) alert(error.message);
    else onSuccess();
  };

  // Calcola se i dati sono stati modificati rispetto agli originali
  const isDirty = 
    form.nome !== (defaultValues?.nome ?? '') ||
    form.cognome !== (defaultValues?.cognome ?? '') ||
    form.telefono !== (defaultValues?.telefono ?? '') ||
    form.email !== (defaultValues?.email ?? '') ||
    JSON.stringify(form.patenti_abilitate) !== JSON.stringify(defaultValues?.patenti_abilitate ?? []);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
              setForm(defaultValues || {
                nome: '',
                cognome: '',
                telefono: '',
                email: '',
                patenti_abilitate: []
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
    </form>
  );
};
