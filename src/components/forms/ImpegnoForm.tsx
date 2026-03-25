'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();
import { Loader2, Calendar, Clock, User, Type, FileText, Trash2, AlertCircle, Plus } from 'lucide-react';
import Select from './Select';
import { ConfirmBubble } from '../ConfirmBubble';
import { useToast } from '@/hooks/useToast';
import { Istruttore, Impegno, TipoImpegno } from '@/lib/database.types';
import { 
  createImpegnoAction, 
  updateImpegnoAction, 
  deleteImpegnoAction,
  getTipiImpegnoAction,
  createTipoImpegnoAction
} from '@/actions/impegni';
import { format } from 'date-fns';

interface ImpegnoFormProps {
  impegnoId?: string;
  defaultValues?: Partial<Impegno>;
  onSuccess: () => void;
  onCancel: () => void;
}

const INPUT_CLS = 'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base h-11';
const LABEL_CLS = 'text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-2';

export const ImpegnoForm = ({
  impegnoId,
  defaultValues,
  onSuccess,
  onCancel,
}: ImpegnoFormProps) => {
  const [loading, setLoading] = useState(false);
  const [istruttori, setIstruttori] = useState<Istruttore[]>([]);
  const [tipi, setTipi] = useState<TipoImpegno[]>([]);
  const [showAddTipo, setShowAddTipo] = useState(false);
  const [newTipoNome, setNewTipoNome] = useState('');
  
  const [durationMode, setDurationMode] = useState<'30' | '60' | 'custom'>(
    defaultValues?.durata === 30 ? '30' : defaultValues?.durata === 60 ? '60' : 'custom'
  );

  const [form, setForm] = useState({
    istruttore_id: defaultValues?.istruttore_id ?? '',
    tipo: defaultValues?.tipo ?? '',
    data: defaultValues?.data ?? format(new Date(), 'yyyy-MM-dd'),
    ora_inizio: defaultValues?.ora_inizio ? defaultValues.ora_inizio.slice(0, 5) : '09:00',
    durata: defaultValues?.durata ?? 60,
    note: defaultValues?.note ?? '',
  });

  const [serverError, setServerError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    async function fetchData() {
      const [iRes, tRes] = await Promise.all([
        supabase.from('istruttori').select('*').order('cognome'),
        getTipiImpegnoAction()
      ]);
      if (iRes.data) setIstruttori(iRes.data);
      if (tRes.success && tRes.data) {
        setTipi(tRes.data);
        if (!form.tipo && tRes.data.length > 0) {
          setForm(prev => ({ ...prev, tipo: tRes.data[0].nome }));
        }
      }
    }
    fetchData();
  }, []);

  const handleAddTipo = async () => {
    if (!newTipoNome.trim()) return;
    setLoading(true);
    const result = await createTipoImpegnoAction({ nome: newTipoNome.trim() });
    setLoading(false);
    if (result.success && result.data) {
      setTipi(prev => [...prev, result.data!].sort((a,b) => a.nome.localeCompare(b.nome)));
      setForm(prev => ({ ...prev, tipo: result.data!.nome }));
      setNewTipoNome('');
      setShowAddTipo(false);
      showToast('Nuovo tipo aggiunto', 'success');
    } else {
      showToast(result.error || 'Errore', 'error');
    }
  };

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.istruttore_id) return showToast('Seleziona un istruttore', 'error');
    
    setLoading(true);
    setServerError(null);

    const payload = {
      ...form,
      ora_inizio: form.ora_inizio + ":00", // Ensure HH:mm:ss
    };

    const result = impegnoId
      ? await updateImpegnoAction(impegnoId, payload)
      : await createImpegnoAction(payload);

    setLoading(false);
    
    if (result.success) {
      showToast(impegnoId ? 'Impegno aggiornato' : 'Impegno creato con successo', 'success');
      onSuccess();
    } else {
      showToast(result.error || 'Errore nel salvataggio', 'error');
      setServerError(result.error || 'Errore tecnico nel salvataggio.');
    }
  };

  const handleDelete = async () => {
    if (!impegnoId) return;
    if (!window.confirm("Sei sicuro di voler eliminare questo impegno? L'azione è definitiva.")) return;

    setLoading(true);
    const result = await deleteImpegnoAction(impegnoId);
    setLoading(false);

    if (result.success) {
      showToast('Impegno eliminato', 'info');
      onSuccess();
    } else {
      showToast(result.error || "Errore eliminazione", 'error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {serverError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={18} />
          <p>{serverError}</p>
        </div>
      )}

      {/* Istruttore */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}><User size={13} /> Istruttore</label>
        <Select
          options={istruttori.map(i => ({
            id: i.id,
            label: `${i.cognome} ${i.nome}`,
            color: i.colore
          }))}
          value={form.istruttore_id}
          onChange={(val) => setForm(prev => ({ ...prev, istruttore_id: val }))}
          icon={User}
          placeholder="Seleziona istruttore..."
          searchable
        />
      </div>

      {/* Tipo Impegno */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}><Type size={13} /> Tipo Impegno</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Select
              options={tipi.map(t => ({ id: t.nome, label: t.nome }))}
              value={form.tipo}
              onChange={(val) => setForm(prev => ({ ...prev, tipo: val }))}
              placeholder={tipi.length === 0 ? "Caricamento..." : "Seleziona tipo..."}
              icon={Type}
              className={showAddTipo ? "opacity-50 pointer-events-none" : ""}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowAddTipo(!showAddTipo)}
            className={cn(
              "shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border transition-all",
              showAddTipo 
                ? "bg-zinc-100 text-zinc-600 border-zinc-200" 
                : "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
            )}
            title="Aggiungi nuovo tipo"
          >
            <Plus size={20} />
          </button>
        </div>

        {showAddTipo && (
          <div className="mt-2 flex gap-2 animate-in fade-in slide-in-from-top-1">
            <input
              autoFocus
              value={newTipoNome}
              onChange={(e) => setNewTipoNome(e.target.value)}
              className={cn(INPUT_CLS, "flex-1")}
              placeholder="Nuovo tipo (es. Esame)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTipo();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddTipo}
              disabled={loading || !newTipoNome.trim()}
              className="px-4 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              Aggiungi
            </button>
          </div>
        )}
      </div>

      {/* Data e Ora */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}><Calendar size={13} /> Data</label>
          <input required type="date" value={form.data} onChange={set('data')} className={INPUT_CLS} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}><Clock size={13} /> Ora Inizio</label>
          <input required type="time" value={form.ora_inizio} onChange={set('ora_inizio')} className={INPUT_CLS} />
        </div>
      </div>

      {/* Durata */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}><Clock size={13} /> Durata (minuti)</label>
        <div className="flex gap-2">
          {(['30', '60'] as const).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => { setDurationMode(d); setForm(p => ({ ...p, durata: parseInt(d) })); }}
              className={cn(
                "flex-1 h-11 rounded-xl text-xs font-bold transition-all border",
                durationMode === d 
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20" 
                  : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300"
              )}
            >
              {d} min
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDurationMode('custom')}
            className={cn(
              "flex-1 h-11 rounded-xl text-xs font-bold transition-all border",
              durationMode === 'custom' 
                ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20" 
                : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300"
            )}
          >
            Altro
          </button>
        </div>
        {durationMode === 'custom' && (
          <input 
            type="number" 
            value={form.durata} 
            onChange={(e) => setForm(p => ({ ...p, durata: parseInt(e.target.value) }))}
            className={cn(INPUT_CLS, "mt-2 animate-in fade-in slide-in-from-top-1")}
            placeholder="Minuti..."
            min={1}
          />
        )}
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}><FileText size={13} /> Note</label>
        <textarea 
          value={form.note} 
          onChange={set('note')} 
          className={cn(INPUT_CLS, "h-24 py-3 resize-none")} 
          placeholder="Dettagli aggiuntivi..."
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
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
          className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center text-sm"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : (impegnoId ? 'Aggiorna' : 'Crea Impegno')}
        </button>
      </div>

      {impegnoId && (
        <ConfirmBubble
          title="Elimina Impegno"
          message="Sei sicuro di voler eliminare questo impegno? L'azione è definitiva."
          confirmLabel="Elimina"
          onConfirm={async () => {
            setLoading(true);
            const result = await deleteImpegnoAction(impegnoId!);
            setLoading(false);
            if (result.success) {
              showToast('Impegno eliminato correttamente', 'info');
              onSuccess();
            } else {
              showToast(result.error || "Errore durante l'eliminazione", 'error');
            }
          }}
          trigger={
            <button
              type="button"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-sm flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              Elimina Impegno
            </button>
          }
        />
      )}
    </form>
  );
};

// Helper for conditional classes
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
