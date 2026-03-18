'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Clock, Car, User, ShieldCheck, Trash2, Edit3, ExternalLink, Phone, MessageCircle } from 'lucide-react';
import { format, addMinutes, parseISO, isAfter } from 'date-fns';
import { it } from 'date-fns/locale';
import { Cliente, Istruttore, Veicolo, Patente, StatoAppuntamento } from '@/lib/database.types';
import { cn } from '@/lib/utils';
import { createAppointmentAction, updateAppointmentAction } from '@/actions/appointments';
import { deleteAppointmentAction, cancelAppointmentAction } from '@/actions/appointment_actions';
import DatePicker from '@/components/DatePicker';
import Link from 'next/link';
import { ClientAutocomplete } from './ClientAutocomplete';

interface FormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialDate?: string;
  initialTime?: string;
  appointmentId?: string;
  initialMode?: 'create' | 'edit' | 'view';
}

// Fixed Premium Light Aesthetic Tokens
const INPUT_CLS = 'w-full bg-[#F4F4F4] border-transparent rounded-[16px] px-4 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 transition-all text-sm h-12 font-semibold text-zinc-900';
const LABEL_CLS = 'text-[11px] font-bold text-zinc-400 uppercase tracking-[0.1em] flex items-center gap-2 ml-1 mb-2';
const VIEW_BLOCK_CLS = 'w-full bg-[#F4F4F4] border-transparent rounded-[16px] px-4 flex items-center h-12 text-sm font-semibold text-zinc-900 transition-all cursor-default overflow-hidden';

export const AppointmentForm = ({ onSuccess, onCancel, initialDate, initialTime, appointmentId, initialMode = 'create' }: FormProps) => {
  const [mode, setMode] = useState<'create' | 'edit' | 'view'>(appointmentId ? initialMode : 'create');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Data Options
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [istruttori, setIstruttori] = useState<Istruttore[]>([]);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [patenti, setPatenti] = useState<Patente[]>([]);

  // Form State
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
    stato: 'programmato' as StatoAppuntamento,
  });
  
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedIstruttore, setSelectedIstruttore] = useState<Istruttore | null>(null);
  const [selectedVeicolo, setSelectedVeicolo] = useState<Veicolo | null>(null);
  
  const [durationMode, setDurationMode] = useState<'30' | '60' | 'custom'>('60');
  const [serverError, setServerError] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<{ instructor_ids: string[], vehicle_ids: string[] }>({ 
    instructor_ids: [], 
    vehicle_ids: [] 
  });

  useEffect(() => {
    async function loadData() {
      setFetching(true);
      try {
        const [cRes, iRes, vRes, pRes] = await Promise.all([
          supabase.from('clienti').select('*').order('cognome'),
          supabase.from('istruttori').select('*').order('cognome'),
          supabase.from('veicoli').select('*').order('nome'),
          supabase.from('patenti').select('*').eq('nascosta', false).order('tipo'),
        ]);

        const sortedClienti = cRes.data ?? [];
        const sortedIstruttori = iRes.data ?? [];
        const sortedVeicoli = vRes.data ?? [];
        const sortedPatenti = pRes.data ?? [];

        setClienti(sortedClienti);
        setIstruttori(sortedIstruttori);
        setVeicoli(sortedVeicoli);
        setPatenti(sortedPatenti);

        if (appointmentId) {
          const { data, error } = await supabase.from('appuntamenti').select('*').eq('id', appointmentId).single();
          const apt = data as (Record<string, any> & { inizio: string; durata: number; stato: string; cambio: string; cliente_id: string; istruttore_id: string; veicolo_id: string; note: string; patente_id: string });
          if (apt && !error) {
            const dateObj = new Date(apt.inizio);
            const duration = apt.durata || 60;
            setForm({
              cliente_id: apt.cliente_id || '',
              istruttore_id: apt.istruttore_id || '',
              veicolo_id: apt.veicolo_id || '',
              data: dateObj.toISOString().split('T')[0],
              ora: format(dateObj, 'HH:mm'),
              durata: duration,
              patente_id: apt.patente_id || '', 
              cambio: (apt.cambio as 'manuale' | 'automatico') || 'manuale', 
              note: apt.note || '',
              stato: (apt.stato as StatoAppuntamento) || 'programmato',
            });
            if (duration === 30) setDurationMode('30');
            else if (duration === 60) setDurationMode('60');
            else setDurationMode('custom');
            
            setSelectedCliente(sortedClienti.find(c => c.id === apt.cliente_id) || null);
            setSelectedIstruttore(sortedIstruttori.find(i => i.id === apt.istruttore_id) || null);
            setSelectedVeicolo(sortedVeicoli.find(v => v.id === apt.veicolo_id) || null);
          }
        }
      } catch {
        // Ignored
      } finally {
        setFetching(false);
      }
    }
    loadData();
  }, [appointmentId]);

  // Fetch Available Slots whenever time/duration changes
  useEffect(() => {
    async function checkAvailability() {
      if (!form.data || !form.ora) return;
      
      const startISO = new Date(`${form.data}T${form.ora}`).toISOString();
      // Check for BUSY slots (is_available = false)
      const { data: busySlots } = await supabase
        .from('time_slots')
        .select('instructor_id, vehicle_id')
        .eq('start_time', startISO)
        .eq('is_available', false)
        .not('appointment_id', 'eq', appointmentId || '00000000-0000-0000-0000-000000000000'); // exclude current if editing

      const busyInstructors = busySlots?.map(s => s.instructor_id).filter(Boolean) as string[] || [];
      const busyVehicles = busySlots?.map(s => s.vehicle_id).filter(Boolean) as string[] || [];

      const nextInstructorIds = istruttori.map(i => i.id).filter(id => !busyInstructors.includes(id));
      const nextVehicleIds = veicoli.map(v => v.id).filter(id => !busyVehicles.includes(id));

      // Stability check: only update if IDs actually changed
      setAvailableSlots(prev => {
        const isSameI = prev.instructor_ids.length === nextInstructorIds.length && 
                        prev.instructor_ids.every((id, idx) => id === nextInstructorIds[idx]);
        const isSameV = prev.vehicle_ids.length === nextVehicleIds.length && 
                        prev.vehicle_ids.every((id, idx) => id === nextVehicleIds[idx]);
        
        if (isSameI && isSameV) return prev;
        return { instructor_ids: nextInstructorIds, vehicle_ids: nextVehicleIds };
      });
    }

    if (!fetching) {
      checkAvailability();
    }
  }, [form.data, form.ora, form.durata, fetching, istruttori, veicoli, appointmentId]);

  const handleClienteChange = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    
    // Auto-fill from client profile
    const updates: Partial<typeof form> = { 
      cliente_id: cliente.id,
      cambio: cliente.preferenza_cambio || 'manuale'
    };

    // 1. Set License type if specified in client profile
    let currentPatenteTipo = 'B';
    if (cliente.patente_richiesta_id) {
      updates.patente_id = cliente.patente_richiesta_id;
      const pat = patenti.find(p => p.id === cliente.patente_richiesta_id);
      if (pat) {
        currentPatenteTipo = pat.tipo;
        if (pat.durata_default) {
          updates.durata = pat.durata_default;
          if (pat.durata_default === 30) setDurationMode('30');
          else if (pat.durata_default === 60) setDurationMode('60');
          else setDurationMode('custom');
        }
      }
    }

    // 2. Intelligent Vehicle Auto-Selection
    // PRIORITY 1: If instructor is already selected AND has a default vehicle compatible with this client
    const instrDefaultId = selectedIstruttore?.veicolo_id;
    if (instrDefaultId) {
      const instrVeh = veicoli.find(v => v.id === instrDefaultId);
      if (instrVeh) {
        const isGearboxMatch = instrVeh.cambio_manuale ? (updates.cambio === 'manuale') : (updates.cambio === 'automatico');
        const isLicenseMatch = instrVeh.tipo_patente === currentPatenteTipo;
        
        if (isGearboxMatch && isLicenseMatch) {
          setSelectedVeicolo(instrVeh);
          setForm(prev => ({ ...prev, ...updates, veicolo_id: instrVeh.id }));
          return;
        }
      }
    }

    // PRIORITY 2: Best client match from all vehicles
    const compatibleVehicles = veicoli.filter(v => {
      const isGearboxMatch = v.cambio_manuale ? (updates.cambio === 'manuale') : (updates.cambio === 'automatico');
      const isLicenseMatch = v.tipo_patente === currentPatenteTipo;
      return isGearboxMatch && isLicenseMatch;
    });

    if (compatibleVehicles.length > 0) {
      setSelectedVeicolo(compatibleVehicles[0]);
      setForm(prev => ({ ...prev, ...updates, veicolo_id: compatibleVehicles[0].id }));
    } else {
      setForm(prev => ({ ...prev, ...updates }));
    }
  };

  const handleIstruttoreChange = (instrId: string) => {
    const instr = istruttori.find(i => i.id === instrId);
    setSelectedIstruttore(instr || null);
    if (!instr) {
      setForm(prev => ({ ...prev, istruttore_id: '' }));
      return;
    }
    
    // PRIORITY: If instructor has a default vehicle AND it's compatible with the current appointment requirements
    const instrDefaultVehicleId = instr?.veicolo_id;
    if (instrDefaultVehicleId) {
      const veh = veicoli.find(v => v.id === instrDefaultVehicleId);
      if (veh) {
        // Validation: Is it compatible with selected patente?
        const currentPatenteTipo = patenti.find(p => p.id === form.patente_id)?.tipo || 'B';
        const isGearboxMatch = veh.cambio_manuale ? (form.cambio === 'manuale') : (form.cambio === 'automatico');
        const isLicenseMatch = veh.tipo_patente === currentPatenteTipo;
        
        // Se c'è un match totale, lo selezioniamo
        if (isGearboxMatch && isLicenseMatch) {
          setSelectedVeicolo(veh);
          setForm(prev => ({ 
            ...prev, 
            istruttore_id: instrId, 
            veicolo_id: instrDefaultVehicleId
          }));
          return;
        }
      }
    }
    
    setForm(prev => ({ ...prev, istruttore_id: instrId }));
  };

  // Logic Check: Filter vehicles based on instructor or client needs
  const availableVeicoli = useMemo(() => {
    // Filter by slots first
    const slotAvailable = veicoli.filter(v => availableSlots.vehicle_ids.includes(v.id));
    
    // Filter by Patente compatibility
    const currentPatenteTipo = patenti.find(p => p.id === form.patente_id)?.tipo || 'B';
    const compatibleWithPatente = slotAvailable.filter(v => v.tipo_patente === currentPatenteTipo);

    if (!selectedIstruttore) return compatibleWithPatente;
    
    // Within compatible vehicles, prioritize instructor's default vehicle
    const instrDefaultId = selectedIstruttore.veicolo_id;
    
    return compatibleWithPatente.sort((a, b) => {
      if (a.id === instrDefaultId) return -1;
      if (b.id === instrDefaultId) return 1;
      return 0;
    });
  }, [veicoli, selectedIstruttore, availableSlots.vehicle_ids, form.patente_id, patenti]);

  const oraFine = useMemo(() => {
    if (!form.ora || isNaN(form.durata)) return '--:--';
    try {
      const [hours, minutes] = form.ora.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return format(addMinutes(date, form.durata), 'HH:mm');
    } catch {
      return '--:--';
    }
  }, [form.ora, form.durata]);

  const isCompleted = useMemo(() => {
    if (form.stato === 'annullato') return false;
    try {
      const now = new Date();
      const endDateTime = addMinutes(new Date(`${form.data}T${form.ora}`), form.durata);
      return isAfter(now, endDateTime);
    } catch {
      return false;
    }
  }, [form.data, form.ora, form.durata, form.stato]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id) return alert('Seleziona un cliente');
    if (!form.istruttore_id) return alert('Seleziona un istruttore');
    setLoading(true);
    const startDateTime = new Date(`${form.data}T${form.ora}`).toISOString();
    const payload = {
      cliente_id: form.cliente_id,
      istruttore_id: form.istruttore_id,
      veicolo_id: form.veicolo_id || null,
      data: startDateTime,
      durata: form.durata,
      stato: form.stato,
      note: form.note || null,
      importo: null,
      send_email: true,
      send_whatsapp: true,
      preferenza_cambio: form.cambio,
    };
    const result = appointmentId ? await updateAppointmentAction(appointmentId, payload) : await createAppointmentAction(payload);
    setLoading(false);
    if (result && result.error) return setServerError(result.error);
    onSuccess?.();
  };

  if (fetching) return <div className="py-24 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  const isView = mode === 'view';

  return (
    <div className="animate-fade-in p-1">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* CLIENTE */}
        <div className="space-y-2">
          <label className={LABEL_CLS}><User size={13} /> CLIENTE</label>
          {isView ? (
            <div className={VIEW_BLOCK_CLS}>
              <span className="flex-1 truncate">{selectedCliente ? `${selectedCliente.cognome} ${selectedCliente.nome}` : 'Nessun cliente'}</span>
              {selectedCliente && (
                <div className="flex gap-1.5 ml-2 shrink-0">
                  {selectedCliente.telefono && (
                    <>
                      <a href={`tel:${selectedCliente.telefono}`} title="Chiama cliente" className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors">
                        <Phone size={14} />
                      </a>
                      <a href={`https://wa.me/39${selectedCliente.telefono.replace(/\D/g, '')}`} title="Invia WhatsApp" target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors">
                        <MessageCircle size={14} />
                      </a>
                    </>
                  )}
                  <Link href={`/clienti/${form.cliente_id}`} className="p-2 bg-zinc-100 text-zinc-400 rounded-xl hover:bg-zinc-200 transition-colors">
                    <ExternalLink size={14} />
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <ClientAutocomplete 
              clients={clienti}
              onSelect={handleClienteChange}
              defaultValue={selectedCliente}
              placeholder="Cerca per cognome o nome..."
            />
          )}
        </div>

        {/* DATA */}
        <div className="space-y-2">
          <label className={LABEL_CLS}>📅 DATA DEL GUIDA</label>
          {isView ? (
            <div className={VIEW_BLOCK_CLS}>{format(parseISO(form.data), 'dd MMMM yyyy', { locale: it })}</div>
          ) : (
            <DatePicker selected={form.data ? new Date(form.data) : new Date()} onChange={(date) => date && setForm(prev => ({ ...prev, data: date.toISOString().split('T')[0] }))} required />
          )}
        </div>
        
        {/* TEMPI */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={LABEL_CLS}>🕒 INIZIO</label>
            {isView ? <div className={VIEW_BLOCK_CLS}>{form.ora}</div> : <input required type="time" title="Ora di inizio" aria-label="Ora di inizio" value={form.ora} onChange={(e) => setForm(prev => ({ ...prev, ora: e.target.value }))} className={cn(INPUT_CLS, 'text-center')} />}
          </div>
          <div className="space-y-2">
            <label className={LABEL_CLS}>🏁 FINE</label>
            <div className={cn(VIEW_BLOCK_CLS, 'text-blue-600 font-bold border-blue-50 bg-blue-50/20 justify-center')}>
              {oraFine}
            </div>
          </div>
        </div>

        {/* PATENTE & DURATA */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={LABEL_CLS}><ShieldCheck size={13} /> PATENTE</label>
            {isView ? (
              <div className={VIEW_BLOCK_CLS}>{patenti.find(p => p.id === form.patente_id)?.tipo || 'B'}</div>
            ) : (
              <select value={form.patente_id} title="Seleziona Patente" onChange={(e) => setForm(prev => ({ ...prev, patente_id: e.target.value }))} className={INPUT_CLS}>
                {patenti.map(p => <option key={p.id} value={p.id}>{p.tipo}</option>)}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <label className={LABEL_CLS}><Clock size={13} /> DURATA (MIN)</label>
            {isView ? (
              <div className={VIEW_BLOCK_CLS}>{form.durata} min</div>
            ) : durationMode !== 'custom' ? (
              <select 
                value={durationMode} 
                title="Seleziona Durata" 
                onChange={(e) => { 
                  const val = e.target.value; 
                  if (val === 'custom') {
                    setDurationMode('custom');
                  } else {
                    const numVal = Number(val);
                    setDurationMode(val as '30' | '60');
                    setForm(prev => ({ ...prev, durata: numVal }));
                  }
                }} 
                className={INPUT_CLS}
              >
                <option value="30">30 min</option>
                <option value="60">60 min</option>
                <option value="custom">Personalizzato...</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input 
                  type="number" 
                  title="Durata personalizzata" 
                  aria-label="Durata personalizzata" 
                  autoFocus 
                  value={form.durata} 
                  onChange={(e) => setForm(prev => ({ ...prev, durata: Number(e.target.value) }))} 
                  className={INPUT_CLS} 
                />
                <button 
                  type="button" 
                  onClick={() => { 
                    setDurationMode('60'); 
                    setForm(prev => ({ ...prev, durata: 60 })); 
                  }} 
                  className="px-4 h-12 rounded-[16px] bg-zinc-100 text-zinc-500 font-bold text-[10px] uppercase tracking-wider shrink-0 hover:bg-zinc-200 transition-all"
                >
                  Annulla
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CAMBIO */}
        <div className="space-y-2">
          <label className={LABEL_CLS}>⚙️ TIPO CAMBIO</label>
          <div className="flex bg-zinc-100 border border-zinc-100 p-1 rounded-2xl w-full sm:w-[320px] shadow-sm">
            {(['manuale', 'automatico'] as const).map(opt => (
              <button key={opt} disabled={isView} type="button" onClick={() => setForm(prev => ({ ...prev, cambio: opt }))} className={cn("flex-1 h-11 rounded-xl text-xs font-black transition-all", form.cambio === opt ? "bg-white text-blue-600 shadow-sm border border-zinc-100" : "text-zinc-400")}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ISTRUTTORE & VEICOLO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={LABEL_CLS}>👤 ISTRUTTORE</label>
            {isView ? (
               <div className={VIEW_BLOCK_CLS}>
                <div className="w-2.5 h-2.5 rounded-full mr-3 shrink-0" style={{ backgroundColor: selectedIstruttore?.colore || '#3b82f6' }} />
                <span className="truncate">{selectedIstruttore ? `${selectedIstruttore.cognome} ${selectedIstruttore.nome}` : 'Non assegnato'}</span>
              </div>
            ) : (
              <select required value={form.istruttore_id} title="Seleziona Istruttore" onChange={(e) => handleIstruttoreChange(e.target.value)} className={INPUT_CLS}>
                <option value="">Seleziona istruttore...</option>
                {istruttori.map(i => {
                  const isBusy = !availableSlots.instructor_ids.includes(i.id);
                  return (
                    <option key={i.id} value={i.id} disabled={isBusy} className={isBusy ? 'text-zinc-300' : ''}>
                      {i.cognome} {i.nome} {isBusy ? '(Occupato)' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <label className={LABEL_CLS}><Car size={13} /> VEICOLO</label>
            {isView ? (
              <div className={VIEW_BLOCK_CLS}>{selectedVeicolo?.nome || 'Senza veicolo'}</div>
            ) : (
              <select value={form.veicolo_id} title="Seleziona Veicolo" onChange={(e) => { const veh = veicoli.find(v => v.id === e.target.value); setSelectedVeicolo(veh || null); setForm(prev => ({ ...prev, veicolo_id: e.target.value })); }} className={INPUT_CLS}>
                <option value="">Seleziona veicolo...</option>
                <option value="">Senza veicolo</option>
                {availableVeicoli.map(v => <option key={v.id} value={v.id}>{v.nome} ({v.targa})</option>)}
              </select>
            )}
          </div>
        </div>

        {/* NOTE */}
        <div className="space-y-2">
          <label className={LABEL_CLS}>📝 NOTE</label>
          {isView ? (
            <div className={cn(VIEW_BLOCK_CLS, "h-24 py-4 items-start leading-relaxed text-zinc-500 italic bg-zinc-50/30 overflow-y-auto whitespace-pre-wrap")}>
              {form.note || "Nessuna nota."}
            </div>
          ) : (
            <textarea rows={3} value={form.note} onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))} className={cn(INPUT_CLS, 'resize-none h-24 py-4 leading-relaxed')} placeholder="Note..." />
          )}
        </div>

        {serverError && <p className="p-4 bg-red-50 text-red-600 text-[11px] font-black rounded-2xl border border-red-100 text-center uppercase tracking-wide">{serverError}</p>}

        {/* BOTTOM ACTIONS */}
        <div className="pt-6">
          {isView ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMode('edit');
                  }} 
                  className="h-14 bg-blue-50 text-blue-600 font-extrabold rounded-2xl text-[11px] uppercase tracking-widest transition-all hover:bg-blue-100/50 flex items-center justify-center gap-2"
                >
                  <Edit3 size={16} /> MODIFICA
                </button>
                <button 
                  type="button" 
                  onClick={async (e) => { 
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.confirm("Annullare?")) { 
                      setLoading(true); 
                      await cancelAppointmentAction(appointmentId!); 
                      onSuccess(); 
                    } 
                  }} 
                  disabled={form.stato === 'annullato'}  
                  className="h-14 bg-orange-50 text-orange-600 font-extrabold rounded-2xl text-[11px] uppercase tracking-widest transition-all hover:bg-orange-100/50 disabled:opacity-30"
                >
                  ANNULLA
                </button>
              </div>
              <button type="button" onClick={async () => { if (window.confirm("Eliminare?")) { setLoading(true); await deleteAppointmentAction(appointmentId!); onSuccess(); } }} className="w-full h-14 bg-red-50 text-red-600 font-extrabold rounded-2xl text-[11px] uppercase tracking-widest transition-all hover:bg-red-100/50 flex items-center justify-center gap-2">
                <Trash2 size={16} /> ELIMINA
              </button>
              <button 
                type="button" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancel();
                }} 
                className="w-full h-14 bg-zinc-900 text-white font-extrabold rounded-2xl text-[11px] uppercase tracking-widest transition-all hover:bg-black"
              >
                CHIUDI
              </button>
              
              {isCompleted && (
                <div className="text-center pt-2">
                  <span className="inline-flex items-center gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 px-10 py-3 rounded-full uppercase tracking-[0.2em] border border-emerald-100 shadow-sm animate-pulse-subtle">
                    ✓ GUIDA SVOLTA
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button disabled={loading} type="submit" className="w-full h-14 rounded-2xl font-black text-white bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/30 transition-all uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 active:scale-95">
                {loading ? <Loader2 className="animate-spin" size={22} /> : (appointmentId ? 'SALVA MODIFICHE' : 'CONFERMA')}
              </button>
              <button 
                type="button" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancel();
                }} 
                className="w-full h-14 rounded-2xl font-bold text-zinc-400 hover:bg-zinc-100 transition-all uppercase text-[11px] tracking-widest"
              >
                Indietro
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
