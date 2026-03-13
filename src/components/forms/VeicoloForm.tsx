'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, CalendarClock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TipoPatente, TipoCambio } from '@/lib/database.types';
import { useRevisionReminder } from '@/hooks/useRevisionReminder';

const TIPI_PATENTE: TipoPatente[] = ['AM', 'A1', 'A2', 'A', 'B1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'];

interface VeicoloFormProps {
  veicoloId?: string;
  defaultValues?: {
    nome: string;
    targa: string;
    data_revisione: string;
    tipo_patente: TipoPatente;
    cambio_manuale: boolean;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

const INPUT_CLS = 'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm';
const LABEL_CLS = 'text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide';

export const VeicoloForm = ({
  veicoloId,
  defaultValues,
  onSuccess,
  onCancel,
}: VeicoloFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome:           defaultValues?.nome            ?? '',
    targa:          defaultValues?.targa           ?? '',
    data_revisione: defaultValues?.data_revisione  ?? '',
    tipo_patente:   defaultValues?.tipo_patente    ?? 'B' as TipoPatente,
    cambio_manuale: defaultValues?.cambio_manuale  ?? true,
  });

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  const { isExpired, isNearExpiry, daysLeft, calendarUrl } = useRevisionReminder(form.data_revisione);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      nome:           form.nome,
      targa:          form.targa.toUpperCase().replace(/\s/g, ''),
      data_revisione: form.data_revisione,
      tipo_patente:   form.tipo_patente,
      cambio_manuale: form.cambio_manuale,
    };

    const { error } = veicoloId
      ? await supabase.from('veicoli').update(payload).eq('id', veicoloId)
      : await supabase.from('veicoli').insert(payload);

    setLoading(false);
    if (error) alert(error.message);
    else onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Nome & Targa */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Nome Veicolo</label>
          <input
            required
            value={form.nome}
            onChange={set('nome')}
            className={INPUT_CLS}
            placeholder="es. Fiat Panda"
          />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Targa</label>
          <input
            required
            value={form.targa}
            onChange={set('targa')}
            className={`${INPUT_CLS} uppercase`}
            placeholder="AA000BB"
            maxLength={8}
          />
        </div>
      </div>

      {/* Scadenza Revisione */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Scadenza Revisione</label>
        <div className="flex items-center gap-2">
          <input
            required
            type="date"
            value={form.data_revisione}
            onChange={set('data_revisione')}
            className={INPUT_CLS}
          />
          {/* Reminder link calendario */}
          {form.data_revisione && calendarUrl && (
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Aggiungi reminder al calendario"
              className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-xl text-xs font-semibold hover:bg-violet-100 transition-colors"
            >
              <CalendarClock size={15} />
            </a>
          )}
        </div>

        {/* Badge stato revisione */}
        {form.data_revisione && daysLeft !== null && (
          <div className={`flex items-center gap-2 text-xs font-semibold mt-1.5 px-3 py-2 rounded-lg ${
            isExpired
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              : isNearExpiry
              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
          }`}>
            {isExpired
              ? <><AlertTriangle size={13} /> Revisione scaduta da {Math.abs(daysLeft)} giorni</>
              : isNearExpiry
              ? <><AlertTriangle size={13} /> Revisione in scadenza: {daysLeft} giorni rimasti</>
              : <><CheckCircle2 size={13} /> Revisione valida — {daysLeft} giorni rimasti</>
            }
          </div>
        )}
      </div>

      {/* Tipo Patente & Cambio */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Tipo Patente</label>
          <select
            value={form.tipo_patente}
            onChange={set('tipo_patente')}
            className={INPUT_CLS}
          >
            {TIPI_PATENTE.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Cambio</label>
          <div className="flex gap-3 pt-1">
            {(['manuale', 'automatico'] as TipoCambio[]).map(tipo => (
              <label key={tipo} className="flex items-center gap-2 cursor-pointer group">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    (form.cambio_manuale ? 'manuale' : 'automatico') === tipo
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-zinc-300 dark:border-zinc-600 group-hover:border-emerald-400'
                  }`}
                  onClick={() => setForm(prev => ({ ...prev, cambio_manuale: tipo === 'manuale' }))}
                >
                  {(form.cambio_manuale ? 'manuale' : 'automatico') === tipo && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 capitalize">
                  {tipo === 'manuale' ? 'M' : 'A'}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">
            {form.cambio_manuale ? 'Cambio Manuale' : 'Cambio Automatico'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm"
        >
          Annulla
        </button>
        <button
          disabled={loading}
          type="submit"
          className="flex-1 py-3 rounded-xl font-semibold bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center justify-center text-sm"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : veicoloId ? 'Salva modifiche' : 'Aggiungi Veicolo'}
        </button>
      </div>
    </form>
  );
};
