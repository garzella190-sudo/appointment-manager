'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Clock, Car, User, Search, Wrench, ShieldCheck, ChevronDown } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import { Cliente, Istruttore, Veicolo, Patente, TipoPatente, CambioAmmesso, StatoAppuntamento } from '@/lib/database.types';
import { cn } from '@/lib/utils';
import { createAppointmentAction, updateAppointmentAction } from '@/actions/appointments';
import DatePicker from '@/components/DatePicker';

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
    send_email: true,
    send_whatsapp: true,
    email_fallback: '',
  });
  
  const [instructorOverlap, setInstructorOverlap] = useState(false);
  const [vehicleOverlap, setVehicleOverlap] = useState(false);
  const [clientOverlap, setClientOverlap] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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

      console.log('Fetching data from Supabase...', { 
        clienti: cRes.data?.length, 
        istruttori: iRes.data?.length, 
        veicoli: vRes.data?.length, 
        patenti: pRes.data?.length 
      });

      if (vRes.error) console.error('Error fetching vehicles:', vRes.error);

      setClienti(cRes.data ?? []);
      setIstruttori(iRes.data ?? []);
      setVeicoli(vRes.data ?? []);
      setPatenti(pRes.data ?? []);

      console.log('State updated - Veicoli:', vRes.data);

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
            patente_id: '', 
            cambio: 'manuale', 
            note: apt.note || '',
            send_email: true,
            send_whatsapp: true,
            email_fallback: '',
          });
        }
      }

      setFetching(false);
    }
    loadData();
  }, [appointmentId]);

  // Validazione Overlap in tempo reale (Strict Database Query)
  useEffect(() => {
    async function checkOverlap() {
      if (!form.data || !form.ora || !form.durata || (!form.istruttore_id && !form.cliente_id)) {
        setInstructorOverlap(false);
        setVehicleOverlap(false);
        setClientOverlap(false);
        return;
      }

      const start = new Date(`${form.data}T${form.ora}`);
      const end = new Date(start.getTime() + form.durata * 60000);
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      let query = supabase
        .from('appuntamenti')
        .select('id, istruttore_id, veicolo_id, cliente_id')
        .neq('stato', 'annullato')
        .eq('data_solo', form.data) // Query filtrata per data per velocità
        .lt('inizio', endISO)
        .gt('fine', startISO);

      if (appointmentId) {
        query = query.neq('id', appointmentId);
      }

      // Costruiamo la condizione OR per Istruttore, Cliente o Veicolo
      let clauses = [];
      if (form.istruttore_id) clauses.push(`istruttore_id.eq.${form.istruttore_id}`);
      if (form.cliente_id) clauses.push(`cliente_id.eq.${form.cliente_id}`);
      if (form.veicolo_id) clauses.push(`veicolo_id.eq.${form.veicolo_id}`);
      
      query = query.or(clauses.join(','));

      const { data: conflitti, error } = await query;

      if (error) {
        console.error('Overlap check error:', error);
        return;
      }

      const iConflict = conflitti?.some(c => form.istruttore_id && c.istruttore_id === form.istruttore_id) || false;
      const vConflict = conflitti?.some(c => form.veicolo_id && c.veicolo_id === form.veicolo_id) || false;
      const cConflict = conflitti?.some(c => form.cliente_id && c.cliente_id === form.cliente_id) || false;

      setInstructorOverlap(iConflict);
      setVehicleOverlap(vConflict);
      setClientOverlap(cConflict);
    }

    const timer = setTimeout(checkOverlap, 300); // Debounce per evitare troppe query
    return () => clearTimeout(timer);
  }, [form.data, form.ora, form.durata, form.istruttore_id, form.veicolo_id, form.cliente_id, appointmentId]);

  // Reset server error when form changes
  useEffect(() => {
    setServerError(null);
  }, [form.data, form.ora, form.durata, form.istruttore_id, form.veicolo_id]);

  // Quando cambia il cliente, se ha una patente richiesta, pre-selezionala
  const handleClienteChange = (clientId: string) => {
    const cliente = clienti.find(c => c.id === clientId);
    setForm(prev => ({ 
      ...prev, 
      cliente_id: clientId,
      // Se il cliente ha una preferenza, applicala subito
      cambio: (cliente?.preferenza_cambio as 'manuale' | 'automatico') || prev.cambio,
      send_email: cliente?.riceve_email ?? true,
      send_whatsapp: cliente?.riceve_whatsapp ?? true,
    }));

    if (cliente?.patente_richiesta_id && !appointmentId) {
      handlePatenteChange(cliente.patente_richiesta_id);
    } else if (!cliente?.patente_richiesta_id && !appointmentId) {
      // Fallback: se il cliente non ha una patente, resetta il campo così l'operatore può sceglierla
      setForm(prev => ({ 
        ...prev, 
        patente_id: '',
        // Se resettiamo la patente, manteniamo comunque la preferenza cambio del cliente per i veicoli
        cambio: (cliente?.preferenza_cambio as 'manuale' | 'automatico') || prev.cambio
      }));
      setSelectedPatente(null);
    }
  };

  // Quando cambia la patente, applica i default (durata, filtraggio veicoli)
  const handlePatenteChange = (patId: string) => {
    const pat = patenti.find(p => p.id === patId);
    setSelectedPatente(pat || null);

    if (pat) {
      setForm(prev => {
        // Se il cliente è già selezionato, cerchiamo di rispettare la sua preferenza
        // se la patente scelta la permette.
        let targetCambio = prev.cambio;
        
        if (pat.cambio_ammesso === 'automatico') {
          targetCambio = 'automatico';
        } else if (pat.cambio_ammesso === 'manuale') {
          targetCambio = 'manuale';
        } 
        // Se pat.cambio_ammesso === 'entrambi', manteniamo targetCambio invariato 
        // (che deriva dal cliente o dalla scelta precedente)

        return {
          ...prev,
          patente_id: patId,
          durata: pat.durata_default,
          cambio: targetCambio,
          // veicolo_id: '',
        };
      });
    } else {
      setForm(prev => ({ ...prev, patente_id: patId }));
    }
  };

  // Quando cambia il veicolo, forza la selezione della patente corrispondente
  const handleVeicoloChange = (veicoloId: string) => {
    const v = veicoli.find(veh => veh.id === veicoloId);
    setForm(prev => ({ ...prev, veicolo_id: veicoloId }));

    if (v && v.tipo_patente) {
      // Trova la patente corrispondente al tipo del veicolo
      const pat = patenti.find(p => p.tipo === v.tipo_patente);
      if (pat) {
        // Usiamo un wrapper per evitare reset ricorsivi se servisse, 
        // ma handlePatenteChange ora non resetta più il veicolo.
        const patObj = pat;
        setSelectedPatente(patObj);
        setForm(prev => {
          let targetCambio = prev.cambio;
          if (patObj.cambio_ammesso === 'automatico') targetCambio = 'automatico';
          else if (patObj.cambio_ammesso === 'manuale') targetCambio = 'manuale';

          return {
            ...prev,
            patente_id: patObj.id,
            durata: patObj.durata_default,
            cambio: targetCambio,
          };
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id || !form.istruttore_id) {
      alert('Scegli cliente ed istruttore');
      return;
    }

    if (instructorOverlap || vehicleOverlap || clientOverlap) {
      alert('Impossibile salvare: risorsa già occupata (Istruttore, Veicolo o Cliente) in questa fascia oraria.');
      return;
    }

    setLoading(true);
    setServerError(null);

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
      send_email: form.send_email,
      send_whatsapp: form.send_whatsapp,
      email_fallback: form.email_fallback || null,
      preferenza_cambio: form.cambio, // Persistiamo la scelta per "memoria"
    };

    let result: any;
    if (appointmentId) {
      result = await updateAppointmentAction(appointmentId, payload);
    } else {
      result = await createAppointmentAction(payload);
    }

    setLoading(false);
    
    if (result && result.error) {
      setServerError(result.error);
      return;
    }

    onSuccess?.();
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

  // Calcolo orario di fine
  const calculateEndTime = () => {
    if (!form.ora || isNaN(form.durata)) return '--:--';
    try {
      const [hours, minutes] = form.ora.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      const end = addMinutes(date, form.durata);
      return format(end, 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  const oraFine = calculateEndTime();

  // Mostra tutti i veicoli (il filtro rigido è stato rimosso per permettere all'utente di trovarli sempre)
  const veicoliFiltrati = veicoli;

  // Auto-selezione veicolo se c'è un match unico
  useEffect(() => {
    if (!appointmentId && veicoliFiltrati.length === 1 && form.veicolo_id !== veicoliFiltrati[0].id) {
      setForm(prev => ({ ...prev, veicolo_id: veicoliFiltrati[0].id }));
    }
  }, [veicoliFiltrati, appointmentId, form.veicolo_id]);

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
        {clientOverlap && (
          <p className="text-red-500 text-sm font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
            Il cliente ha già un altro impegno in questo orario
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Data */}
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Data</label>
          <DatePicker
            selected={form.data ? new Date(form.data) : new Date()}
            onChange={(date) => {
              if (date) {
                const formatted = date.toISOString().split('T')[0];
                setForm(prev => ({ ...prev, data: formatted }));
              }
            }}
            required
          />
        </div>
        {/* Ora Inizio */}
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Inizio</label>
          <input
            required
            type="time"
            value={form.ora}
            onChange={(e) => setForm(prev => ({ ...prev, ora: e.target.value }))}
            className={INPUT_CLS}
          />
        </div>
        {/* Ora Fine (Calcolata) */}
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Fine</label>
          <div className={cn(INPUT_CLS, 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 font-medium flex items-center')}>
            {oraFine}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Patente Config */}
        <div className="space-y-1.5">
          <label className={LABEL_CLS}><ShieldCheck size={13} /> Tipo Patente</label>
          <select
            disabled={!!form.veicolo_id}
            value={form.patente_id}
            onChange={(e) => handlePatenteChange(e.target.value)}
            className={cn(
              INPUT_CLS,
              form.veicolo_id && "bg-zinc-100 dark:bg-zinc-800/50 cursor-not-allowed opacity-70"
            )}
          >
            <option value="">{form.veicolo_id ? 'Vincolata dal veicolo' : 'Nessuna / Altro'}</option>
            {patenti
              .filter(p => !p.nascosta) // Mostra solo le patenti non nascoste
              .map(p => (
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

      {/* Tipo Cambio Selector */}
      <div className="space-y-1.5">
        <label className={LABEL_CLS}><Wrench size={13} /> Tipo Cambio</label>
        <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-xl w-fit">
          {[
            { id: 'manuale', label: 'Manuale' },
            { id: 'automatico', label: 'Automatico' }
          ].map(opt => {
            const isSelected = form.cambio === opt.id;
            const isForced = selectedPatente && (
              (selectedPatente.cambio_ammesso === 'manuale' && opt.id === 'automatico') ||
              (selectedPatente.cambio_ammesso === 'automatico' && opt.id === 'manuale')
            );
            
            return (
              <button
                key={opt.id}
                type="button"
                disabled={!!isForced}
                onClick={() => setForm(prev => ({ ...prev, cambio: opt.id as any, veicolo_id: '' }))}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  isSelected 
                    ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-700",
                  isForced && "opacity-30 cursor-not-allowed"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {selectedPatente && selectedPatente.cambio_ammesso !== 'entrambi' && (
          <p className="text-[10px] text-zinc-500 italic">Il tipo di cambio è vincolato dalla categoria {selectedPatente.tipo}.</p>
        )}
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
          {instructorOverlap && (
            <p className="text-red-500 text-sm font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
              Istruttore non disponibile
            </p>
          )}
        </div>
        {/* Veicolo */}
        <div className="space-y-1.5">
          <label className={LABEL_CLS}><Car size={13} /> Veicolo</label>
          <select
            value={form.veicolo_id}
            onChange={(e) => handleVeicoloChange(e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">Senza veicolo / Teoria</option>
            {veicoli.map(v => (
              <option key={v.id} value={v.id}>{v.nome} ({v.targa})</option>
            ))}
            {veicoli.length === 0 && (
              <option disabled>Nessun veicolo trovato nel database</option>
            )}
          </select>
          {vehicleOverlap && (
            <p className="text-red-500 text-sm font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
              Veicolo non disponibile
            </p>
          )}
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

      {/* Manual Notification Overrides */}
      <div className="flex items-center gap-6 px-1">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={form.send_email}
            onChange={(e) => setForm(prev => ({ ...prev, send_email: e.target.checked }))}
            className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500/20"
          />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600 transition-colors">Invia Email</span>
          </div>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={form.send_whatsapp}
            onChange={(e) => setForm(prev => ({ ...prev, send_whatsapp: e.target.checked }))}
            className="w-4 h-4 rounded border-zinc-300 text-green-600 focus:ring-green-500/20"
          />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-green-600 transition-colors">Invia WhatsApp</span>
          </div>
        </label>
      </div>

      {/* Dynamic Email Input for missing email */}
      {form.send_email && form.cliente_id && !clienti.find(c => c.id === form.cliente_id)?.email && (
        <div className="space-y-1.5 px-1 animate-in fade-in slide-in-from-top-2 duration-300">
          <label className={LABEL_CLS}>Email cliente mancante. Inseriscila qui:</label>
          <input
            type="email"
            placeholder="Esempio: nome@email.it"
            value={form.email_fallback}
            onChange={(e) => setForm(prev => ({ ...prev, email_fallback: e.target.value }))}
            className={cn(INPUT_CLS, "border-blue-200 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10")}
          />
          <p className="text-[10px] text-zinc-500 italic">L'email verrà salvata permanentemente nel profilo del cliente.</p>
        </div>
      )}

      {/* Server Error Message */}
      {serverError && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
          {serverError}
        </div>
      )}

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
          disabled={loading || instructorOverlap || vehicleOverlap || clientOverlap}
          type="submit"
          className={cn(
            "flex-1 py-3 rounded-xl font-semibold text-white shadow-lg transition-all flex items-center justify-center text-sm",
            (instructorOverlap || vehicleOverlap || clientOverlap) 
              ? "bg-zinc-300 cursor-not-allowed shadow-none" 
              : "bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700"
          )}
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : (appointmentId ? 'Aggiorna Appuntamento' : 'Crea Appuntamento')}
        </button>
      </div>
    </form>
  );
};
