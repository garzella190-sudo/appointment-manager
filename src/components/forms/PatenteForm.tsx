'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, BadgeCheck, Clock } from 'lucide-react';
import { TipoPatente } from '@/lib/database.types';

interface PatenteFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const INPUT_CLS = 'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm';
const LABEL_CLS = 'text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5';

export const PatenteForm = ({
  onSuccess,
  onCancel,
}: PatenteFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tipo: '',
    nome: '',
    durata: 60,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tipo) return;
    setLoading(true);

    const { error } = await supabase.from('patenti').upsert({
      tipo: form.tipo.toUpperCase(),
      nome_visualizzato: form.nome || `Patente ${form.tipo.toUpperCase()}`,
      durata_default: Number(form.durata) || 60,
    }, { onConflict: 'tipo' });

    setLoading(false);
    if (error) alert(error.message);
    else onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>
            <BadgeCheck size={14} /> Codice Categoria
          </label>
          <input
            required
            value={form.tipo}
            onChange={e => setForm(prev => ({ ...prev, tipo: e.target.value }))}
            className={`${INPUT_CLS} uppercase font-mono font-bold`}
            placeholder="es. B96"
            maxLength={5}
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>
            <Clock size={14} /> Durata Default (min)
          </label>
          <input
            required
            type="number"
            min={15}
            max={240}
            step={5}
            value={form.durata}
            onChange={e => setForm(prev => ({ ...prev, durata: Number(e.target.value) }))}
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Nome Visualizzato (Opzionale)</label>
        <input
          value={form.nome}
          onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
          className={INPUT_CLS}
          placeholder="es. Patente B con rimorchio"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm"
        >
          Annulla
        </button>
        <button
          disabled={loading || !form.tipo}
          type="submit"
          className="flex-1 py-3 rounded-xl font-semibold bg-purple-600 text-white shadow-lg shadow-purple-500/20 hover:bg-purple-700 transition-all flex items-center justify-center text-sm disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Aggiungi Categoria'}
        </button>
      </div>
    </form>
  );
};
