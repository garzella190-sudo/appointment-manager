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

// iOS Optimized classes
const INPUT_CLS = 'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm appearance-none h-11';
const LABEL_CLS = 'text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5';

export const AppointmentForm = ({ onSuccess, onCancel, initialDate, initialTime, appointmentId }: FormProps) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

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
    patente_id: '',
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
            cambio: (apt as any).preferenza_cambio || 'manuale', 
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

  useEffect(() => {
    async function checkOverlap() {
      if (!form.data || !form.ora || !form.durata || (!form.istruttore_id && !form.cliente_id)) {
        setInstructorOverlap(false);
        setVehicleOverlap(false);
        setClientOverlap(false);
        return;
      }

      const start = new Date(`${form.data}T${form.ora}`);
      start.setSeconds(0, 0);
      const end = new Date(start.getTime() + form.durata * 60000);
      end.setSeconds(0, 0);
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      let query = supabase
        .from('appuntamenti')
        .select('id, istruttore_id, veicolo_id, cliente_id')
        .neq('stato', 'annullato')
        .eq('data_solo', form.data)
        .lt('inizio', endISO)
        .gt('fine', startISO);

      if (appointmentId) query = query.neq('id', appointmentId);

      let clauses = [];
      if (form.istruttore_id) clauses.push(`istruttore_id.eq.${form.istruttore_id}`);
      if (form.cliente_id) clauses.push(`cliente_id.eq.${form.cliente_id}`);
      if (form.veicolo_id) clauses.push(`veicolo_id.eq.${form.veicolo_id}`);
      
      query = query.or(clauses.join(','));

      const { data: conflitti, error } = await query;

      if (!error) {
        setInstructorOverlap(conflitti?.some((c: any) => form.istruttore_id && c.istruttore_id === form.istruttore_id) || false);
        setVehicleOverlap(conflitti?.some((c: any) => form.veicolo_id && c.veicolo_id === form.veicolo_id) || false);
        setClientOverlap(conflitti?.some((c: any) => form.cliente_id && c.cliente_id === form.cliente_id) || false);
      }
    }
    const timer = setTimeout(checkOverlap, 300);
    return () => clearTimeout(timer);
  }, [form.data, form.ora, form.durata, form.istruttore_id, form.veicolo_id, form.cliente_id, appointmentId]);

  const handleClienteChange = (clientId: string) => {
    const cliente = clienti.find(c => c.id === clientId);
    setForm(prev => ({ 
      ...prev, 
      cliente_id: clientId,
      cambio: (cliente?.preferenza_cambio as any) || prev.cambio,
      send_email: cliente?.riceve_email ?? true,
      send_whatsapp: cliente?.riceve_whatsapp ?? true,
    }));
    if (cliente?.patente_richiesta_id && !appointmentId) handlePatenteChange(cliente.patente_richiesta_id);
  };

  const handlePatenteChange = (patId: string) => {
    const pat = patenti.find(p => p.id === patId);
    setSelectedPatente(pat || null);
    if (pat) {
      setForm(prev => ({
        ...prev,
        patente_id: patId,
        durata: pat.durata_default,
        cambio: pat.cambio_ammesso !== 'entrambi' ? (pat.cambio_ammesso as any) : prev.cambio,
      }));
    } else {
      setForm(prev => ({ ...prev, patente_id: patId }));
    }
  };

  const handleVeicoloChange = (veicoloId: string) => {
    const v = veicoli.find(veh => veh.id === veicoloId);
    setForm(prev => ({ ...prev, veicolo_id: veicoloId }));
    if (v && v.tipo_patente) {
      const pat = patenti.find(p => p.tipo === v.tipo_patente);
      if (pat) {
        setSelectedPatente(pat);
        setForm(prev => ({
          ...prev,
          patente_id: pat.id,
          durata: pat.durata_default,
          cambio: pat.cambio_ammesso !== 'entrambi' ? (pat.cambio_ammesso as any) : prev.cambio,
        }));
      }
    }
  };

  useEffect(() => {
    // Se la categoria è 'B', impostiamo automaticamente il veicolo di default dell'istruttore
    const selectedPatente = patenti.find(p => p.id === form.patente_id);
    const selectedIstruttore = istruttori.find(i => i.id === form.istruttore_id);

    if (selectedPatente?.tipo === 'B' && selectedIstruttore?.default_vehicle_id) {
      setForm(prev => ({ ...prev, veicolo_id: selectedIstruttore.default_vehicle_id! }));
    }
  }, [form.istruttore_id, form.patente_id, patenti, istruttori]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id || !form.istruttore_id) return alert('Scegli cliente ed istruttore');
    if (instructorOverlap || vehicleOverlap || clientOverlap) return alert('Risorsa già occupata.');

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
      send_email: form.send_email,
      send_whatsapp: form.send_whatsapp,
      email_fallback: form.email_fallback || null,
      preferenza_cambio: form.cambio,
    };

    const result = appointmentId 
      ? await updateAppointmentAction(appointmentId, payload)
      : await createAppointmentAction(payload);

    setLoading(false);
    if (result && result.error) return setServerError(result.error);
    onSuccess?.();
  };

  const oraFine = (() => {
    if (!form.ora || isNaN(form.durata)) return '--:--';
    const [hours, minutes] = form.ora.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return format(addMinutes(date, form.durata), 'HH:mm');
  })();

  if (fetching) return (
    <div className="py-20 flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500" size={32} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className={LABEL_CLS}><User size={13} /> Cliente</label>
        <select required value={form.cliente_id} onChange={(e) => handleClienteChange(e.target.value)} className={INPUT_CLS}>
          <option value="">Scegli un cliente...</option>
          {clienti.map(c => <option key={c.id} value={c.id}>{c.cognome} {c.nome}</option>)}
        </select>
        {clientOverlap && <p className="text-red-500 text-[10px] mt-1 font-bold uppercase">Cliente già occupato</p>}
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Data del Guida</label>
          <DatePicker
            selected={form.data ? new Date(form.data) : new Date()}
            onChange={(date) => date && setForm(prev => ({ ...prev, data: date.toISOString().split('T')[0] }))}
            required
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Inizio</label>
            <input required type="time" value={form.ora} onChange={(e) => setForm(prev => ({ ...prev, ora: e.target.value }))} className={INPUT_CLS} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Fine</label>
            <div className={cn(INPUT_CLS, 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 font-bold flex items-center')}>
              {oraFine}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}><ShieldCheck size={13} /> Patente</label>
          <select disabled={!!form.veicolo_id} value={form.patente_id} onChange={(e) => handlePatenteChange(e.target.value)} className={INPUT_CLS}>
            <option value="">{form.veicolo_id ? 'Dal veicolo' : 'Scegli...'}</option>
            {patenti.filter(p => !p.nascosta).map(p => <option key={p.id} value={p.id}>{p.nome_visualizzato || p.tipo}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}><Clock size={13} /> Durata (min)</label>
          <input required type="number" step={5} min={15} value={form.durata} onChange={(e) => setForm(prev => ({ ...prev, durata: parseInt(e.target.value) }))} className={INPUT_CLS} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={LABEL_CLS}><Wrench size={13} /> Tipo Cambio</label>
        <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-xl w-fit">
          {['manuale', 'automatico'].map(opt => (
            <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, cambio: opt as any }))} className={cn("px-6 h-9 rounded-lg text-xs font-bold transition-all appearance-none", form.cambio === opt ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-sm" : "text-zinc-500")}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Istruttore</label>
          <select required value={form.istruttore_id} onChange={(e) => setForm(prev => ({ ...prev, istruttore_id: e.target.value }))} className={INPUT_CLS}>
            <option value="">Scegli istruttore...</option>
            {istruttori.map(i => <option key={i.id} value={i.id}>{i.cognome} {i.nome}</option>)}
          </select>
          {instructorOverlap && <p className="text-red-500 text-[10px] mt-1 font-bold uppercase">Non disponibile</p>}
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}><Car size={13} /> Veicolo</label>
          <select value={form.veicolo_id} onChange={(e) => handleVeicoloChange(e.target.value)} className={INPUT_CLS}>
            <option value="">Senza veicolo</option>
            {veicoli.map(v => <option key={v.id} value={v.id}>{v.nome} ({v.targa})</option>)}
          </select>
          {vehicleOverlap && <p className="text-red-500 text-[10px] mt-1 font-bold uppercase">Non disponibile</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Note / Obiettivi</label>
        <textarea rows={2} value={form.note} onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))} className={cn(INPUT_CLS, 'resize-none h-auto min-h-[80px] py-3 appearance-none')} placeholder="Esercizi..." />
      </div>

      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 h-11 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-all appearance-none">
          Annulla
        </button>
        <button disabled={loading || instructorOverlap || vehicleOverlap || clientOverlap} type="submit" className={cn("flex-1 h-11 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center appearance-none", (instructorOverlap || vehicleOverlap || clientOverlap) ? "bg-zinc-300" : "bg-blue-600 hover:bg-blue-700")}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : (appointmentId ? 'Salva Modifiche' : 'Crea Appuntamento')}
        </button>
      </div>
    </form>
  );
};
