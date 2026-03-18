'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, CalendarClock, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { TipoPatente, TipoCambio, Patente } from '@/lib/database.types';
import { useRevisionReminder } from '@/hooks/useRevisionReminder';
import { createVeicoloAction, updateVeicoloAction, deleteVeicoloAction } from '@/actions/veicoli';
import DatePicker from '@/components/DatePicker';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';


interface VeicoloFormProps {
  veicoloId?: string;
  defaultValues?: {
    nome: string;
    targa: string;
    data_revisione: string;
    tipo_patente: TipoPatente;
    cambio_manuale: boolean;
    colore?: string;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

const INPUT_CLS = 'w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm';
const LABEL_CLS = 'text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1';

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
    colore:         defaultValues?.colore          ?? '#10B981',
  });
  const [patenti, setPatenti] = useState<Patente[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Sincronizza lo stato quando cambiano i defaultValues (importante se il modal non viene smontato)
  useEffect(() => {
    if (defaultValues) {
      setForm({
        nome:           defaultValues.nome            ?? '',
        targa:          defaultValues.targa           ?? '',
        data_revisione: defaultValues.data_revisione  ?? '',
        tipo_patente:   defaultValues.tipo_patente    ?? 'B' as TipoPatente,
        cambio_manuale: defaultValues.cambio_manuale  ?? true,
        colore:         defaultValues.colore          ?? '#10B981',
      });
    } else {
      // Reset per nuovo veicolo
      setForm({
        nome: '',
        targa: '',
        data_revisione: '',
        tipo_patente: 'B' as TipoPatente,
        cambio_manuale: true,
        colore: '#10B981',
      });
    }
  }, [defaultValues]);
  
  useEffect(() => {
    async function fetchPatenti() {
      const { data } = await supabase.from('patenti').select('*').eq('nascosta', false).order('tipo');
      if (data) setPatenti(data);
    }
    fetchPatenti();
  }, []);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  const { isExpired, isNearExpiry, daysLeft, calendarUrl } = useRevisionReminder(form.data_revisione);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setServerError(null);

    const payload = {
      nome:           form.nome,
      targa:          form.targa.toUpperCase().replace(/\s/g, ''),
      data_revisione: form.data_revisione,
      tipo_patente:   form.tipo_patente,
      cambio_manuale: form.cambio_manuale,
      colore:         form.colore,
    };

    const result = veicoloId
      ? await updateVeicoloAction(veicoloId, payload)
      : await createVeicoloAction(payload);

    setLoading(false);
    
    if (result.success) {
      showToast(veicoloId ? 'Veicolo aggiornato con successo!' : 'Veicolo creato con successo!', 'success');
      onSuccess();
    } else {
      showToast(result.error || 'Errore nel salvataggio del veicolo', 'error');
      setServerError(result.error || 'Si è verificato un errore nel salvataggio.');
    }
  };

  const handleDelete = async () => {
    if (!veicoloId) return;
    if (!window.confirm("Sei sicuro di voler eliminare questo veicolo? L'azione è irreversibile.")) return;

    setLoading(true);
    const result = await deleteVeicoloAction(veicoloId);
    setLoading(false);

    if (result.success) {
      showToast('Veicolo eliminato definitivamente', 'info');
      onSuccess();
    } else {
      showToast(result.error || "Errore durante l'eliminazione", 'error');
      setServerError(result.error || "Errore durante l'eliminazione.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {serverError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle size={18} className="shrink-0" />
          <p className="font-medium">{serverError}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            className={`${INPUT_CLS} uppercase font-mono tracking-widest`}
            placeholder="AA000BB"
            maxLength={8}
          />
        </div>
      </div>

      {/* Scadenza Revisione */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Scadenza Revisione</label>
        <div className="flex items-center gap-2">
          <DatePicker
            selected={form.data_revisione ? new Date(form.data_revisione) : new Date()}
            onChange={(date) => {
              if (date) {
                const formatted = date.toISOString().split('T')[0];
                setForm(prev => ({ ...prev, data_revisione: formatted }));
              }
            }}
            required
          />
          {form.data_revisione && calendarUrl && (
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Aggiungi reminder al calendario"
              className="shrink-0 flex items-center justify-center w-12 h-12 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-2xl hover:bg-violet-100 transition-colors"
            >
              <CalendarClock size={20} />
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
      <div className="space-y-4">
        <div className="space-y-3">
          <label className={LABEL_CLS}>Categoria Patente</label>
          <div className="flex flex-wrap gap-2 p-1 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl">
            {patenti.map(p => {
              const tipo = p.tipo;
              const active = form.tipo_patente === tipo;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, tipo_patente: tipo }))}
                  title={p.nome_visualizzato || tipo}
                  className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                    active
                      ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {tipo}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Cambio</label>
          <div className="flex gap-4 pt-1">
            {(['manuale', 'automatico'] as TipoCambio[]).map(tipo => (
              <button 
                key={tipo} 
                type="button"
                onClick={() => setForm(prev => ({ ...prev, cambio_manuale: tipo === 'manuale' }))}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    (form.cambio_manuale ? 'manuale' : 'automatico') === tipo
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-zinc-300 dark:border-zinc-600 group-hover:border-emerald-400'
                  }`}
                >
                  {(form.cambio_manuale ? 'manuale' : 'automatico') === tipo && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 capitalize">
                  {tipo === 'manuale' ? 'Meccanico (M)' : 'Automatico (A)'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label htmlFor="colore" className={LABEL_CLS}>Colore Identificativo</label>
        <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <input
            id="colore"
            type="color"
            value={form.colore}
            title="Colore Identificativo"
            onChange={set('colore')}
            className="w-14 h-14 p-1 bg-white dark:bg-zinc-800 border-none rounded-2xl cursor-pointer shadow-sm"
          />
          <div>
            <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase font-mono tracking-widest">{form.colore}</span>
            <p className="text-xs text-zinc-500 mt-0.5">Questo colore verrà usato nel calendario.</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm"
        >
          Annulla
        </button>
        <button
          disabled={loading}
          type="submit"
          className="flex-1 py-4 rounded-2xl font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center text-sm gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : veicoloId ? 'Salva modifiche' : 'Aggiungi Veicolo'}
        </button>
      </div>
        {veicoloId && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="w-full mt-2 py-4 rounded-2xl font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-sm flex items-center justify-center gap-2"
          >
            <Trash2 size={18} />
            Elimina Veicolo
          </button>
        )}
    </form>
  );
};
