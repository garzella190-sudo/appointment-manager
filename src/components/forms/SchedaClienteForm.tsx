'use client'; 

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();
import { Loader2, Phone, Mail, BadgeCheck, AlertCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Cliente, Patente, TipoPatente, TipoCambio } from '@/lib/database.types';
import Select from './Select';
import { ConfirmBubble } from '../ConfirmBubble';
import { 
  createClienteAction, 
  updateClienteAction, 
  deleteClienteAction 
} from '@/actions/clienti';

interface SchedaClienteFormProps {
  clienteId?: string;    // undefined → nuovo cliente
  defaultValues?: {
    nome: string;
    cognome: string;
    telefono: string;
    email: string;
    patente_richiesta_id: string | null;
    preferenza_cambio: string | null;
    riceve_email?: boolean;
    riceve_whatsapp?: boolean;
  };
  patenti: Patente[];
  onSuccess: (id: string) => void;
  onCancel?: () => void;
}

const INPUT_CLS =
  'w-full bg-[#F4F4F4] dark:bg-zinc-900 border-transparent rounded-[16px] py-2.5 px-4 outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 transition-all text-base font-semibold text-zinc-900 dark:text-zinc-100 h-12';

const LABEL_CLS = 'text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-2';

export const SchedaClienteForm = ({
  clienteId,
  defaultValues,
  patenti,
  onSuccess,
  onCancel,
}: SchedaClienteFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome:                 defaultValues?.nome ?? '',
    cognome:              defaultValues?.cognome ?? '',
    telefono:             defaultValues?.telefono ?? '',
    email:                defaultValues?.email ?? '',
    patente_richiesta_id: defaultValues?.patente_richiesta_id ?? '',
    preferenza_cambio:    defaultValues?.preferenza_cambio ?? '',
    riceve_email:         defaultValues?.riceve_email ?? true,
    riceve_whatsapp:      defaultValues?.riceve_whatsapp ?? true,
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const { showToast } = useToast();

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payloadNome = form.nome.trim().split(/\\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const payloadCognome = form.cognome.trim().split(/\\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const payloadEmail = form.email ? form.email.trim().toLowerCase() : null;

    const payloadTelefono = form.telefono?.trim() || null;

    // Duplicate Check logic with safer array joining
    const predicates = [`and(nome.eq."${payloadNome}",cognome.eq."${payloadCognome}")`];
    if (payloadTelefono) predicates.push(`telefono.eq."${payloadTelefono}"`);
    if (payloadEmail)    predicates.push(`email.eq."${payloadEmail}"`);
    
    const { data: duplicates } = await supabase.from('clienti')
      .select('id')
      .or(predicates.join(','))
      .filter('id', 'neq', clienteId || '00000000-0000-0000-0000-000000000000')
      .limit(1);

    if (duplicates && duplicates.length > 0) {
      showToast("Un altro cliente con lo stesso nome, telefono o email è già registrato.", "error");
      setServerError("Cliente duplicato trovato.");
      setLoading(false);
      return;
    }

    const payload = {
      nome:                 payloadNome,
      cognome:              payloadCognome,
      telefono:             payloadTelefono,
      email:                payloadEmail,
      patente_richiesta_id: form.patente_richiesta_id || null,
      preferenza_cambio:    (form.preferenza_cambio as TipoCambio) || null,
      riceve_email:         form.riceve_email,
      riceve_whatsapp:      form.riceve_whatsapp,
    };

    const result = clienteId
      ? await updateClienteAction(clienteId, payload)
      : await createClienteAction(payload);

    setLoading(false);

    if (result.success) {
      showToast(clienteId ? 'Scheda cliente aggiornata' : 'Nuovo cliente registrato con successo', 'success');
      onSuccess(result.id as string);
    } else {
      showToast(result.error || 'Errore nel salvataggio del cliente', 'error');
      setServerError(result.error || 'Si è verificato un errore nel salvataggio.');
    }
  };

  const handleDelete = async () => {
    if (!clienteId) return;
    if (!window.confirm("Sei sicuro di voler eliminare questo cliente? L'azione è definitiva.")) return;

    setLoading(true);
    const result = await deleteClienteAction(clienteId);
    setLoading(false);

    if (result.success) {
      showToast('Cliente eliminato definitivamente', 'info');
      onSuccess(clienteId);
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
      {/* Cognome & Nome */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Cognome</label>
          <input required value={form.cognome} onChange={set('cognome')} className={INPUT_CLS} placeholder="Rossi" />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Nome</label>
          <input required value={form.nome} onChange={set('nome')} className={INPUT_CLS} placeholder="Mario" />
        </div>
      </div>

      {/* Telefono — con link tel: visualizzato accanto */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Telefono (Opzionale)</label>
        <div className="flex items-center gap-2">
          <input
            value={form.telefono}
            onChange={set('telefono')}
            className={INPUT_CLS}
            placeholder="Esempio: 333 1234567"
            type="tel"
          />
        </div>
      </div>

      {/* Email — con link mailto: visualizzato accanto */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Email (Opzionale)</label>
        <div className="flex items-center gap-2">
          <input
            value={form.email}
            onChange={set('email')}
            className={INPUT_CLS}
            placeholder="mario.rossi@email.it"
            type="email"
          />
          {form.email && (
            <a
              href={`mailto:${form.email}`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              title="Invia email"
            >
              <Mail size={15} />
              Email
            </a>
          )}
        </div>
      </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Patente Richiesta</label>
          <Select
            searchable={true}
            options={patenti.map(p => ({ id: p.id, label: p.nome_visualizzato || p.tipo }))}
            value={form.patente_richiesta_id || ''}
            onChange={(val) => setForm(prev => ({ ...prev, patente_richiesta_id: val }))}
            icon={BadgeCheck}
            placeholder="Seleziona Patente"
          />
        </div>

        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Tipo Cambio</label>
          <Select
            options={[
              { id: 'manuale', label: 'Meccanico (Manuale)' },
              { id: 'automatico', label: 'Automatico' }
            ]}
            value={form.preferenza_cambio || ''}
            onChange={(val) => setForm(prev => ({ ...prev, preferenza_cambio: val }))}
            placeholder="Seleziona Preferenza Cambio"
          />
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50 space-y-3">
        <p className={LABEL_CLS}>Preferenze Notifiche</p>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={form.riceve_email}
              onChange={(e) => setForm(prev => ({ ...prev, riceve_email: e.target.checked }))}
              className="w-5 h-5 rounded-lg border-zinc-300 text-blue-600 focus:ring-blue-500/20"
            />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600 transition-colors">Riceve Email</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={form.riceve_whatsapp}
              onChange={(e) => setForm(prev => ({ ...prev, riceve_whatsapp: e.target.checked }))}
              className="w-5 h-5 rounded-lg border-zinc-300 text-green-600 focus:ring-green-500/20"
            />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-green-600 transition-colors">Riceve WhatsApp</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm"
          >
            Annulla
          </button>
        )}
        <button
          disabled={loading}
          type="submit"
          className="flex-1 py-3 rounded-xl font-semibold bg-purple-600 text-white shadow-lg shadow-purple-500/20 hover:bg-purple-700 transition-all flex items-center justify-center text-sm"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : clienteId ? 'Salva modifiche' : 'Crea Cliente'}
        </button>
      </div>
      {clienteId && (
        <ConfirmBubble
          title="Elimina Cliente"
          message="Sei sicuro di voler eliminare questo cliente? L'azione è definitiva."
          confirmLabel="Elimina"
          onConfirm={async () => {
            setLoading(true);
            const result = await deleteClienteAction(clienteId!);
            setLoading(false);
            if (result.success) {
              showToast('Cliente eliminato correttamente', 'info');
              onSuccess(clienteId!);
            } else {
              showToast(result.error || "Errore durante l'eliminazione", 'error');
              setServerError(result.error || "Errore durante l'eliminazione.");
            }
          }}
          trigger={
            <button
              type="button"
              disabled={loading}
              className="w-full mt-3 py-3 rounded-xl font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-sm flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              Elimina Cliente
            </button>
          }
        />
      )}
    </form>
  );
};
