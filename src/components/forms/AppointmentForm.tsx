'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Clock, Car, User, Search, Wrench, ShieldCheck, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { Cliente, Istruttore, Veicolo, Patente, TipoPatente, CambioAmmesso, StatoAppuntamento } from '@/lib/database.types';
import { cn } from '@/lib/utils';

interface FormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialDate?: string;
  initialTime?: string;
  appointmentId?: string;
}

const INPUT_CLS = 'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm';
const LABEL_CLS = 'text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5';

export const AppointmentForm = ({ onSuccess, onCancel, initialDate, initialTime, appointmentId }: FormProps) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Data options
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [istruttori, setIstruttori] = useState<Istruttore[]>([]);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [patenti, setPatenti] = useState<Patente[]>([]);

  // Form state
  const [form, setForm] = useState({
    cliente_id: '',
    istruttore_id: '',
    veicolo_id: '',
    data: initialDate || new Date().toISOString().split('T')[0],
    ora: initialTime || '09:00',
    durata: 60,
    patente_id: '', // ID della configurazione patente scelta
    cambio: 'manuale' as 'manuale' | 'automatico',
    note: '',
  });

  const [selectedPatente, setSelectedPatente] = useState<Patente | null>(null);

  useEffect(() => {
    async function loadData() {
      setFetching(true);

      // Fetch options
      const [cRes, iRes, vRes, pRes] = await Promise.all([
        supabase.from('clienti').select('*').order('cognome'),
        supabase.from('istruttori').select('*').order('cognome'),
        supabase.from('veicoli').select('*').order('nome'),
        supabase.from('patenti').select('*').order('tipo'),
      ]);

      setClienti(cRes.data ?? []);
      setIstruttori(iRes.data ?? []);
      setVeicoli(vRes.data ?? []);
      setPatenti(pRes.data ?? []);

      // If editing, fetch appointment details
      if (appointmentId) {
        const { data: apt, error } = await supabase
          .from('appuntamenti')
          .select('*')
          .eq('id', appointmentId)
          .single();

        if (apt && !error) {
          const dateObj = new Date(apt.data);
          setForm({
            cliente_id: apt.cliente_id || '',
            istruttore_id: apt.istruttore_id || '',
            veicolo_id: apt.veicolo_id || '',
            data: dateObj.toISOString().split('T')[0],
            ora: format(dateObj, 'HH:mm'),
            durata: apt.durata || 60,
            patente_id: '', // Non salviamo più il patente_id direttamente, va ricavato se serve
            cambio: 'manuale', // Da recuperare dal cliente se necessario in futuro
            note: apt.note || '',
          });
        }
      }

      setFetching(false);
    }
    loadData();
  }, [appointmentId]);

  // Quando cambia il cliente, se ha una patente richiesta, pre-selezionala
  const handleClienteChange = (clientId: string) => {
    const cliente = clienti.find(c => c.id === clientId);
    setForm(prev => ({ 
      ...prev, 
      cliente_id: clientId,
      // Se il cliente ha una preferenza, applicala subito
      cambio: (cliente?.preferenza_cambio as 'manuale' | 'automatico') || prev.cambio
    }));

    if (cliente?.patente_richiesta_id && !appointmentId) {
      handlePatenteChange(cliente.patente_richiesta_id);
    }
  };

  // Quando cambia la patente, applica i default (durata, filtraggio veicoli)
  const handlePatenteChange = (patId: string) => {
    const pat = patenti.find(p => p.id === patId);
    setSelectedPatente(pat || null);

    if (pat) {
      setForm(prev => ({
        ...prev,
        patente_id: patId,
        durata: pat.durata_default,
        // Se il cambio ammesso è solo automatico, imposta automatico
        cambio: pat.cambio_ammesso === 'automatico' ? 'automatico' : 'manuale',
        // Resetta veicolo se non è tra i preferiti della patente (opzionale)
        veicolo_id: '',
      }));
    } else {
      setForm(prev => ({ ...prev, patente_id: patId }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id || !form.istruttore_id) {
      alert('Scegli cliente ed istruttore');
      return;
    }

    setLoading(true);

    const startDateTime = new Date(`${form.data}T${form.ora}`).toISOString();
    const payload = {
      cliente_id: form.cliente_id,
      istruttore_id: form.istruttore_id,
      veicolo_id: form.veicolo_id || null,
      data: startDateTime,
      durata: form.durata,
      stato: 'programmato' as StatoAppuntamento,
      note: form.note || null,
      importo: null,
    };

    let error;
    if (appointmentId) {
      const { error: err } = await supabase
        .from('appuntamenti')
        .update(payload)
        .eq('id', appointmentId);
      error = err;
    } else {
      const { error: err } = await supabase
        .from('appuntamenti')
        .insert(payload);
      error = err;
    }

    setLoading(false);
    if (!error) onSuccess();
    else alert(error.message);
  };

  const handleDelete = async () => {
    if (!appointmentId || !confirm('Sei sicuro di voler eliminare questo appuntamento?')) return;

    setDeleting(true);
    const { error } = await supabase
      .from('appuntamenti')
      .delete()
      .eq('id', appointmentId);

    setDeleting(false);
    if (!error) onSuccess();
    else alert(error.message);
  };

  // Filtra veicoli in base alla patente selezionata E al tipo di cambio
  const veicoliFiltrati = (selectedPatente && selectedPatente.veicoli_abilitati?.length > 0
    ? veicoli.filter(v => selectedPatente.veicoli_abilitati.includes(v.id))
    : selectedPatente
      ? veicoli.filter(v => v.tipo_patente === selectedPatente.tipo) // Fallback al tipo patente
      : veicoli
  ).filter(v => {
    if (form.cambio === 'manuale') return v.cambio_manuale === true;
    if (form.cambio === 'automatico') return v.cambio_manuale === false;
    return true;
  });

  if (fetching) {
    return (
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Cliente Section */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}><User size={13} /> Cliente</label>
        <select
          required
          value={form.cliente_id}
          onChange={(e) => handleClienteChange(e.target.value)}
          className={INPUT_CLS}
        >
          <option value="">Scegli un cliente...</option>
          {clienti.map(c => (
            <option key={c.id} value={c.id}>{c.cognome} {c.nome}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Data */}
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Data</label>
          <input
            required
            type="date"
            value={form.data}
            onChange={(e) => setForm(prev => ({ ...prev, data: e.target.value }))}
            className={INPUT_CLS}
          />
        </div>
        {/* Ora */}
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Ora Inizio</label>
          <input
            required
            type="time"
            value={form.ora}
            onChange={(e) => setForm(prev => ({ ...prev, ora: e.target.value }))}
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Patente Config */}
        <div className="space-y-1.5">
          <label className={LABEL_CLS}><ShieldCheck size={13} /> Tipo Patente</label>
          <select
            value={form.patente_id}
            onChange={(e) => handlePatenteChange(e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">Nessuna / Altro</option>
            {patenti.map(p => (
              <option key={p.id} value={p.id}>{p.nome_visualizzato || p.tipo}</option>
            ))}
          </select>
        </div>
        {/* Durata */}
        <div className="space-y-1.5">
          <label className={LABEL_CLS}><Clock size={13} /> Durata (min)</label>
          <input
            required
            type="number"
            step={5}
            min={15}
            value={form.durata}
            onChange={(e) => setForm(prev => ({ ...prev, durata: parseInt(e.target.value) }))}
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Istruttore */}
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Istruttore</label>
          <select
            required
            value={form.istruttore_id}
            onChange={(e) => setForm(prev => ({ ...prev, istruttore_id: e.target.value }))}
            className={INPUT_CLS}
          >
            <option value="">Scegli istruttore...</option>
            {istruttori.map(i => {
              // Verifica se l'istruttore è abilitato per questa patente (UI hint)
              const isEnabled = !selectedPatente || i.patenti_abilitate.includes(selectedPatente.tipo);
              return (
                <option key={i.id} value={i.id} className={!isEnabled ? 'text-zinc-400' : ''}>
                  {i.cognome} {i.nome} {!isEnabled ? '(non abilitato)' : ''}
                </option>
              );
            })}
          </select>
        </div>
        {/* Veicolo */}
        <div className="space-y-1.5">
          <label className={LABEL_CLS}><Car size={13} /> Veicolo</label>
          <select
            value={form.veicolo_id}
            onChange={(e) => setForm(prev => ({ ...prev, veicolo_id: e.target.value }))}
            className={INPUT_CLS}
          >
            <option value="">Senza veicolo / Teoria</option>
            {veicoliFiltrati.map(v => (
              <option key={v.id} value={v.id}>{v.nome} ({v.targa})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Note / Obiettivi Lezione</label>
        <textarea
          rows={2}
          value={form.note}
          onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
          className={cn(INPUT_CLS, 'resize-none')}
          placeholder="Esercizi parcheggio, prima guida..."
        />
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
          {loading ? <Loader2 className="animate-spin" size={18} /> : (appointmentId ? 'Aggiorna Appuntamento' : 'Crea Appuntamento')}
        </button>
      </div>
    </form>
  );
};
