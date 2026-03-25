'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();
import { Loader2, Phone, Mail, Trash2, AlertCircle, Car, Pencil, User } from 'lucide-react';
import Select from './Select';
import { useToast } from '@/hooks/useToast';
import { TipoPatente, Patente } from '@/lib/database.types';
import { 
  createIstruttoreAction, 
  updateIstruttoreAction, 
  deleteIstruttoreAction 
} from '@/actions/istruttori';
import { cn } from '@/lib/utils';
import { ConfirmBubble } from '../ConfirmBubble';


interface IstruttoreFormProps {
  istruttoreId?: string;
  initialMode?: 'edit' | 'view';
  defaultValues?: {
    nome: string;
    cognome: string;
    telefono: string;
    email: string;
    patenti_abilitate: TipoPatente[];
    colore?: string;
    veicolo_id?: string | null;
    id?: string;
    updated_at?: string;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

const INPUT_CLS = 'w-full bg-[#F4F4F4] dark:bg-zinc-900 border-transparent rounded-[16px] py-2.5 px-4 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-base font-semibold text-zinc-900 dark:text-zinc-100 h-12';
const LABEL_CLS = 'text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-2';
const VIEW_BLOCK_CLS = 'w-full bg-[#F4F4F4] dark:bg-zinc-900/50 rounded-[16px] px-4 flex items-center h-12 text-base font-semibold text-zinc-900 dark:text-zinc-100 transition-all cursor-default overflow-hidden';

export const IstruttoreForm = ({
  istruttoreId,
  initialMode = 'edit',
  defaultValues,
  onSuccess,
  onCancel,
}: IstruttoreFormProps) => {
  const [mode, setMode] = useState<'edit' | 'view'>(istruttoreId ? initialMode : 'edit');
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<{id: string, nome: string, targa: string}[]>([]);
  const [patenti, setPatenti] = useState<Patente[]>([]);

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
    colore: defaultValues?.colore ?? '#3B82F6',
    veicolo_id: defaultValues?.veicolo_id ?? '',
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    async function fetchData() {
      const [vRes, pRes] = await Promise.all([
        supabase.from('veicoli').select('id, nome, targa').is('eliminato_il', null).order('nome'),
        supabase.from('patenti').select('*').is('eliminato_il', null).eq('nascosta', false).order('tipo')
      ]);
      if (vRes.data) setVehicles(vRes.data);
      if (pRes.data) setPatenti(pRes.data);
    }
    fetchData();
  }, []);

  useEffect(() => {
    const vals = defaultValues;
    if (vals) {
      setForm({
        nome: capitalizeWords(vals.nome ?? ''),
        cognome: capitalizeWords(vals.cognome ?? ''),
        telefono: vals.telefono ?? '',
        email: vals.email ?? '',
        patenti_abilitate: (vals.patenti_abilitate || []) as TipoPatente[],
        colore: vals.colore ?? '#3B82F6',
        veicolo_id: vals.veicolo_id ?? '',
      });
    }
  }, [defaultValues?.id, defaultValues?.updated_at]); // Use specific fields for stability

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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
    setServerError(null);

    const payload = {
      nome: form.nome,
      cognome: form.cognome,
      telefono: form.telefono || null,
      email: form.email || null,
      patenti_abilitate: form.patenti_abilitate,
      colore: form.colore,
      veicolo_id: form.veicolo_id || null,
    };

    const result = istruttoreId
      ? await updateIstruttoreAction(istruttoreId, payload)
      : await createIstruttoreAction(payload);

    setLoading(false);
    
    if (result.success) {
      showToast(istruttoreId ? 'Anagrafica istruttore aggiornata' : 'Nuovo istruttore creato con successo', 'success');
      onSuccess();
    } else {
      showToast(result.error || 'Errore nel salvataggio dell\'istruttore', 'error');
      setServerError(result.error || 'Si è verificato un errore nel salvataggio.');
    }
  };

  const handleDelete = async () => {
    if (!istruttoreId) return;
    if (!window.confirm("Sei sicuro di voler eliminare questo istruttore? I dati rimarranno nel database ma non saranno più visibili nell'applicazione.")) return;

    setLoading(true);
    const result = await deleteIstruttoreAction(istruttoreId);
    setLoading(false);

    if (result.success) {
      showToast('Istruttore eliminato correttamente', 'info');
      onSuccess();
    } else {
      showToast(result.error || "Errore durante l'eliminazione", 'error');
      setServerError(result.error || "Errore durante l'eliminazione.");
    }
  };

  const initials = `${form.cognome[0] ?? ''}${form.nome[0] ?? ''}`.toUpperCase();
  const isView = mode === 'view';

  return (
    <div className="animate-fade-in">
      {isView && (
        <div className="flex items-center gap-5 mb-8 bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800">
          <div 
            className="w-16 h-16 rounded-2xl text-white shadow-lg flex items-center justify-center text-2xl font-black"
            style={{ backgroundColor: form.colore }}
          >
            {initials || <User size={32} />}
          </div>
          <div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 leading-tight">{form.cognome} {form.nome}</h3>
            <p className="text-xs font-bold text-zinc-400 mt-0.5 tracking-widest uppercase">Istruttore Certificato</p>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
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
          {isView ? (
            <div className={VIEW_BLOCK_CLS}>{form.cognome}</div>
          ) : (
            <input 
              required 
              value={form.cognome} 
              onChange={(e) => setForm(prev => ({ ...prev, cognome: capitalizeWords(e.target.value) }))} 
              className={INPUT_CLS} 
              placeholder="Rossi" 
            />
          )}
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Nome</label>
          {isView ? (
            <div className={VIEW_BLOCK_CLS}>{form.nome}</div>
          ) : (
            <input 
              required 
              value={form.nome} 
              onChange={(e) => setForm(prev => ({ ...prev, nome: capitalizeWords(e.target.value) }))} 
              className={INPUT_CLS} 
              placeholder="Mario" 
            />
          )}
        </div>
      </div>

      {/* Telefono */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Telefono</label>
        {isView ? (
          <div className={VIEW_BLOCK_CLS}>
            <span className="flex-1">{form.telefono || 'Non inserito'}</span>
            {form.telefono && (
              <a href={`tel:${form.telefono.replace(/\s/g, '')}`} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors">
                <Phone size={14} />
              </a>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input value={form.telefono} onChange={set('telefono')} className={INPUT_CLS} placeholder="333 1234567" type="tel" />
            {form.telefono && (
              <a
                href={`tel:${form.telefono.replace(/\s/g, '')}`}
                title="Chiama istruttore"
                aria-label="Chiama istruttore"
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-sm font-semibold hover:bg-green-100 transition-colors"
              >
                <Phone size={14} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Email</label>
        {isView ? (
          <div className={VIEW_BLOCK_CLS}>
            <span className="flex-1 truncate">{form.email || 'Non inserita'}</span>
            {form.email && (
              <a href={`mailto:${form.email}`} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors">
                <Mail size={14} />
              </a>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input value={form.email} onChange={set('email')} className={INPUT_CLS} placeholder="mario@email.it" type="email" />
            {form.email && (
              <a
                href={`mailto:${form.email}`}
                title="Invia email"
                aria-label="Invia email"
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors"
              >
                <Mail size={14} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Patenti abilitate */}
      <div className="space-y-2">
        <label className={LABEL_CLS}>Patenti Abilitate</label>
        <div className="flex flex-wrap gap-2">
          {isView ? (
            form.patenti_abilitate.length > 0 ? (
              form.patenti_abilitate.map(tipo => (
                <span key={tipo} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold uppercase ring-1 ring-blue-500/10">
                  {tipo}
                </span>
              ))
            ) : (
                <div className={VIEW_BLOCK_CLS}>Nessun abilitazione</div>
            )
          ) : (
            patenti.map(p => {
              const tipo = p.tipo;
              const active = form.patenti_abilitate.includes(tipo);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePatente(tipo)}
                  title={p.nome_visualizzato || tipo}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-transparent hover:border-zinc-300'
                  }`}
                >
                  {tipo}
                </button>
              );
            })
          )}
        </div>
        {!isView && form.patenti_abilitate.length === 0 && (
          <p className="text-xs text-amber-500">Seleziona almeno una patente</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="trainer-color" className={LABEL_CLS}>Colore Identificativo</label>
        <div className="flex items-center gap-3 bg-[#F4F4F4] dark:bg-zinc-900/50 p-4 rounded-2xl">
          <input
            id="trainer-color"
            type="color"
            disabled={isView}
            title="Scegli colore"
            aria-label="Scegli colore"
            value={form.colore}
            onChange={set('colore')}
            className="w-12 h-10 p-1 bg-white dark:bg-zinc-800 border-transparent rounded-xl cursor-all transition-transform active:scale-95 disabled:cursor-default"
          />
          <span className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">{form.colore}</span>
        </div>
      </div>

      {/* Veicolo Predefinito */}
      <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <label className={LABEL_CLS}>Veicolo Predefinito</label>
        {isView ? (
          <div className={VIEW_BLOCK_CLS}>
            {vehicles.find(v => v.id === form.veicolo_id) 
              ? `${vehicles.find(v => v.id === form.veicolo_id)?.nome} (${vehicles.find(v => v.id === form.veicolo_id)?.targa})` 
              : 'Nessun veicolo assigned'}
          </div>
        ) : (
          <Select
            options={[
              { id: '', label: 'Nessun veicolo assegnato' },
              ...vehicles.map(v => ({
                id: v.id,
                label: `${v.nome} (${v.targa})`
              }))
            ]}
            value={form.veicolo_id}
            onChange={(val) => setForm(prev => ({ ...prev, veicolo_id: val }))}
            icon={Car}
            placeholder="Seleziona veicolo"
            searchable
          />
        )}
        {!isView && (
          <p className="text-[10px] text-zinc-400 mt-1">
            Verrà proposto automaticamente durante la creazione di nuovi appuntamenti.
          </p>
        )}
      </div>


      {/* Actions */}
      <div className="flex gap-4 pt-4">
        {isView ? (
          <>
            <button
              type="button"
              onClick={() => setMode('edit')}
              className="flex-1 py-4 rounded-2xl font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all text-sm flex items-center justify-center gap-2"
            >
              <Pencil size={18} />
              Modifica
            </button>
            <ConfirmBubble
              title="Elimina Istruttore"
              message="Sei sicuro di voler eliminare questo istruttore? I dati rimarranno nel database ma non saranno più visibili."
              confirmLabel="Elimina"
              onConfirm={async () => {
                setLoading(true);
                const result = await deleteIstruttoreAction(istruttoreId!);
                setLoading(false);
                if (result.success) {
                  showToast('Istruttore eliminato correttamente', 'info');
                  onSuccess();
                } else {
                  showToast(result.error || "Errore durante l'eliminazione", 'error');
                  setServerError(result.error || "Errore durante l'eliminazione.");
                }
              }}
              trigger={
                <button
                  type="button"
                  disabled={loading}
                  className="px-6 py-4 rounded-2xl font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-sm flex items-center justify-center"
                  title="Elimina"
                >
                  <Trash2 size={18} />
                </button>
              }
            />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={istruttoreId ? () => setMode('view') : onCancel}
              className="flex-1 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm"
            >
              Annulla
            </button>
            <button
              disabled={loading || form.patenti_abilitate.length === 0}
              type="submit"
              className="flex-1 py-4 rounded-2xl font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center text-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : istruttoreId ? 'Aggiorna anagrafica' : 'Crea Istruttore'}
            </button>
          </>
        )}
      </div>
    </form>
    </div>
  );
};
