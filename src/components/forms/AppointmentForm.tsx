'use client'; 

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();
import { Loader2, Clock, Car, User, ShieldCheck, Trash2, Edit3, ExternalLink, Phone, MessageCircle, Save, Pencil, X, Plus, ChevronDown, Check, CalendarPlus } from 'lucide-react';
import { format, addMinutes, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { Cliente, Istruttore, Veicolo, Patente, StatoAppuntamento } from '@/lib/database.types';
import { cn } from '@/lib/utils';
import { createAppointmentAction, updateAppointmentAction } from '@/actions/appointments';
import { deleteAppointmentAction, cancelAppointmentAction, updateAppointmentNoteAction } from '@/actions/appointment_actions';
import { toggleProntoEsameAction } from '@/actions/clienti';
import { useAuth } from '@/hooks/useAuth';
import { GraduationCap, CheckCircle2, Search, Send, FileEdit, RefreshCw, XCircle } from 'lucide-react';
import DatePicker from '@/components/DatePicker';
import Link from 'next/link';
import { ClientAutocomplete } from './ClientAutocomplete';
import { WhatsAppButton } from '../WhatsAppButton';
import { useToast } from '@/hooks/useToast';
import { addToOfflineQueue } from '@/lib/offlineSync';
import { Modal } from '../Modal';
import { SchedaClienteForm } from './SchedaClienteForm';
import { AssignExamSessionModal } from '../modals/AssignExamSessionModal';
import { generateWhatsAppLink } from '@/utils/whatsapp';

import Select from './Select';
import { ConfirmBubble } from '../ConfirmBubble';

interface FormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialDate?: string;
  initialTime?: string;
  appointmentId?: string;
  initialMode?: 'create' | 'edit' | 'view';
  defaultIsImpegno?: boolean;
}

// Fixed Premium Light Aesthetic Tokens
const INPUT_CLS = 'w-full bg-[#F4F4F4] border-transparent rounded-[16px] px-4 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 transition-all text-base h-12 font-semibold text-zinc-900';
const LABEL_CLS = 'text-[11px] font-bold text-zinc-400 uppercase tracking-[0.1em] flex items-center gap-2 ml-1 mb-2';
const VIEW_BLOCK_CLS = 'w-full bg-[#F4F4F4] border-transparent rounded-[16px] px-4 flex items-center h-12 text-base font-semibold text-zinc-900 transition-all cursor-default overflow-hidden';

const TIME_OPTIONS = Array.from({ length: (22 - 8) * 4 + 1 }, (_, i) => {
  const totalMinutes = i * 15;
  const h = Math.floor(totalMinutes / 60) + 8;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
});

export const AppointmentForm = ({ onSuccess, onCancel, initialDate, initialTime, appointmentId, initialMode = 'create', defaultIsImpegno = false }: FormProps) => {
  const { role, isAdmin, isSegreteria } = useAuth();
  const [mode, setMode] = useState<'create' | 'edit' | 'view'>(appointmentId ? initialMode : 'create');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { showToast } = useToast();
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Data Options
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [istruttori, setIstruttori] = useState<Istruttore[]>([]);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [patenti, setPatenti] = useState<Patente[]>([]);

  // Form State
  const [isImpegno, setIsImpegno] = useState(defaultIsImpegno);
  const [nomeImpegno, setNomeImpegno] = useState('');
  const [impegniNames, setImpegniNames] = useState<string[]>([]);
  const [showImpegniDropdown, setShowImpegniDropdown] = useState(false);

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
  
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [emailFallback, setEmailFallback] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedIstruttore, setSelectedIstruttore] = useState<Istruttore | null>(null);
  const [selectedVeicolo, setSelectedVeicolo] = useState<Veicolo | null>(null);
  
  const [durationMode, setDurationMode] = useState<'30' | '60' | 'custom'>('60');
  const [serverError, setServerError] = useState<string | null>(null);
  const [addingCliente, setAddingCliente] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<{ instructor_ids: string[], vehicle_ids: string[], busy_client_ids: string[] }>({ 
    instructor_ids: [], 
    vehicle_ids: [],
    busy_client_ids: []
  });
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize notes
  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = 'auto';
      noteRef.current.style.height = `${noteRef.current.scrollHeight}px`;
    }
  }, [form.note]);

  useEffect(() => {
    async function loadData() {
      setFetching(true);
      try {
        const [cRes, iRes, vRes, pRes, impRes] = await Promise.all([
          supabase.from('clienti').select('*, sessioni_esame(data)').neq('nome', 'UFFICIO').order('cognome'),
          supabase.from('istruttori').select('*').order('cognome'),
          supabase.from('veicoli').select('*').order('nome'),
          supabase.from('patenti').select('*').eq('nascosta', false).order('tipo'),
          supabase.from('clienti').select('cognome').eq('nome', 'UFFICIO'),
        ]);

        // Extract unique impegno names
        const uniqueNames = Array.from(new Set((impRes.data ?? []).map((c: {cognome: string}) => c.cognome))).filter(Boolean).sort() as string[];
        setImpegniNames(uniqueNames);

        // Filter active clients: not archived and no past exam
        const today = startOfDay(new Date());
        const sortedClienti = (cRes.data ?? []).filter((c: any) => {
           if (c.id === appointmentId) return true; // Keep current client if editing
           if (c.archiviato) return false;
           
           const examDate = c.sessioni_esame?.data ? startOfDay(parseISO(c.sessioni_esame.data)) : null;
           const isPast = examDate && isBefore(examDate, today);
           return !isPast;
        });
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
            
            if (apt.cliente_id) {
              const client = (sortedClienti as Cliente[]).find((c: Cliente) => c.id === apt.cliente_id);
              if (client?.nome === 'UFFICIO') {
                setIsImpegno(true);
                setNomeImpegno(client.cognome);
              }
              setSelectedCliente(client || null);
            }
            setSelectedIstruttore((sortedIstruttori as Istruttore[]).find((i: Istruttore) => i.id === apt.istruttore_id) || null);
            setSelectedVeicolo((sortedVeicoli as Veicolo[]).find((v: Veicolo) => v.id === apt.veicolo_id) || null);
          }
        } else {
          // New appointment: auto-fill from logged-in user's instructor association
          try {
            const browserSupabase = createClient();
            const { data: { user } } = await browserSupabase.auth.getUser();
            const linkedInstrId = user?.user_metadata?.istruttore_id;
            if (linkedInstrId) {
              const instr = (sortedIstruttori as Istruttore[]).find((i: Istruttore) => i.id === linkedInstrId);
              if (instr) {
                setSelectedIstruttore(instr);
                // Auto-select instructor's default vehicle (for patente B)
                const instrVehicleId = instr.veicolo_id;
                if (instrVehicleId) {
                  const veh = (sortedVeicoli as Veicolo[]).find((v: Veicolo) => v.id === instrVehicleId);
                  if (veh) {
                    setSelectedVeicolo(veh);
                    setForm(prev => ({ ...prev, istruttore_id: linkedInstrId, veicolo_id: instrVehicleId }));
                  } else {
                    setForm(prev => ({ ...prev, istruttore_id: linkedInstrId }));
                  }
                } else {
                  setForm(prev => ({ ...prev, istruttore_id: linkedInstrId }));
                }
              }
            }
          } catch {
            // Session not available, skip auto-fill
          }
          
          // Auto-fill memory dates if not provided by calendar explicit click
          const memoryDate = localStorage.getItem('lastApptDate');
          const memoryTime = localStorage.getItem('lastApptTime');
          if (!initialDate && memoryDate) {
            setForm(prev => ({ ...prev, data: memoryDate }));
          }
          if (!initialTime && memoryTime) {
            setForm(prev => ({ ...prev, ora: memoryTime }));
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
      
      const startDate = new Date(`${form.data}T${form.ora}`);
      if (isNaN(startDate.getTime())) return;
      
      const startISO = startDate.toISOString();
      const endISO = new Date(startDate.getTime() + form.durata * 60000).toISOString();

      try {
        // Query appuntamenti directly for overlaps
        const { data: overlapping } = await supabase
          .from('appuntamenti')
          .select('istruttore_id, veicolo_id, cliente_id')
          
          .neq('id', appointmentId || '00000000-0000-0000-0000-000000000000')
          .neq('stato', 'annullato')
          .lt('inizio', endISO)
          .gt('fine', startISO);

        const busyInstructors = overlapping?.map((a: any) => a.istruttore_id).filter(Boolean) as string[] || [];
        const busyVehicles = overlapping?.map((a: any) => a.veicolo_id).filter(Boolean) as string[] || [];
        const busyClients = overlapping?.map((a: any) => a.cliente_id).filter(Boolean) as string[] || [];

        // If a client is busy, they shouldn't be selectable, but we handle that at validation time.
        // For instructors and vehicles:
        const nextInstructorIds = istruttori.map(i => i.id).filter(id => !busyInstructors.includes(id));
        const nextVehicleIds = veicoli.map(v => v.id).filter(id => !busyVehicles.includes(id));

        setAvailableSlots(prev => {
          const isSameI = prev.instructor_ids.slice().sort().join(',') === nextInstructorIds.slice().sort().join(',');
          const isSameV = prev.vehicle_ids.slice().sort().join(',') === nextVehicleIds.slice().sort().join(',');
          const isSameC = (prev.busy_client_ids || []).slice().sort().join(',') === busyClients.slice().sort().join(',');
          
          if (isSameI && isSameV && isSameC) return prev;
          return { instructor_ids: nextInstructorIds, vehicle_ids: nextVehicleIds, busy_client_ids: busyClients };
        });
      } catch (err) {
        console.error('Error checking availability:', err);
      }
    }

    if (!fetching) {
      checkAvailability();
    }
  }, [form.data, form.ora, form.durata, fetching, istruttori, veicoli, appointmentId]);

  const handleClienteChange = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    
    // Base updates from client profile
    const updates: Partial<typeof form> = { 
      cliente_id: cliente.id,
      cambio: cliente.preferenza_cambio || 'manuale'
    };

    // Set License type if specified in client profile
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

    // ─── PRIORITY 1: Storico cliente — copia istruttore e veicolo dall'ultimo appuntamento ───
    try {
      const { data: lastApt } = await supabase
        .from('appuntamenti')
        .select('istruttore_id, veicolo_id')
        .eq('cliente_id', cliente.id)
        .neq('stato', 'annullato')
        .order('data', { ascending: false })
        .limit(1)
        .single();

      if (lastApt?.istruttore_id) {
        const histInstr = istruttori.find(i => i.id === lastApt.istruttore_id);
        const histVeh = lastApt.veicolo_id ? veicoli.find(v => v.id === lastApt.veicolo_id) : null;

        if (histInstr) {
          setSelectedIstruttore(histInstr);
          updates.istruttore_id = histInstr.id;

          if (histVeh) {
            setSelectedVeicolo(histVeh);
            updates.veicolo_id = histVeh.id;
          }

          setForm(prev => ({ ...prev, ...updates }));
          return; // Storico trovato → uscita immediata
        }
      }
    } catch {
      // Nessuno storico trovato, procedi al fallback
    }

    // ─── PRIORITY 2: Profilo utente — istruttore collegato alla sessione ───
    try {
      const browserSupabase = createClient();
      const { data: { user } } = await browserSupabase.auth.getUser();
      const linkedInstrId = user?.user_metadata?.istruttore_id;
      if (linkedInstrId) {
        const profileInstr = istruttori.find(i => i.id === linkedInstrId);
        if (profileInstr) {
          setSelectedIstruttore(profileInstr);
          updates.istruttore_id = profileInstr.id;

          // Auto-select instructor's default vehicle if compatible
          if (profileInstr.veicolo_id) {
            const instrVeh = veicoli.find(v => v.id === profileInstr.veicolo_id);
            if (instrVeh) {
              const isGearboxMatch = instrVeh.cambio_manuale ? (updates.cambio === 'manuale') : (updates.cambio === 'automatico');
              const isMoto = ['AM', 'A1', 'A2', 'A'].includes(currentPatenteTipo);
              const isLicenseMatch = isMoto ? ['AM', 'A1', 'A2', 'A'].includes(instrVeh.tipo_patente) : instrVeh.tipo_patente === currentPatenteTipo;
              if (isGearboxMatch && isLicenseMatch) {
                setSelectedVeicolo(instrVeh);
                updates.veicolo_id = instrVeh.id;
              }
            }
          }

          setForm(prev => ({ ...prev, ...updates }));
          return; // Profilo trovato → uscita
        }
      }
    } catch {
      // Sessione non disponibile, procedi al fallback
    }

    // ─── PRIORITY 3: Matching per patente — veicolo compatibile + istruttore abilitato ───
    // 3a. Trova un istruttore abilitato per questa patente
    const enabledInstructors = istruttori.filter(i => 
      i.patenti_abilitate && i.patenti_abilitate.includes(currentPatenteTipo as any)
    );
    if (enabledInstructors.length > 0) {
      const bestInstr = enabledInstructors[0];
      setSelectedIstruttore(bestInstr);
      updates.istruttore_id = bestInstr.id;

      // Se l'istruttore ha un veicolo default compatibile, usalo
      if (bestInstr.veicolo_id) {
        const instrVeh = veicoli.find(v => v.id === bestInstr.veicolo_id);
        if (instrVeh) {
          const isGearboxMatch = instrVeh.cambio_manuale ? (updates.cambio === 'manuale') : (updates.cambio === 'automatico');
          const isMoto = ['AM', 'A1', 'A2', 'A'].includes(currentPatenteTipo);
          const isLicenseMatch = isMoto ? ['AM', 'A1', 'A2', 'A'].includes(instrVeh.tipo_patente) : instrVeh.tipo_patente === currentPatenteTipo;
          if (isGearboxMatch && isLicenseMatch) {
            setSelectedVeicolo(instrVeh);
            setForm(prev => ({ ...prev, ...updates, veicolo_id: instrVeh.id }));
            return;
          }
        }
      }
    }

    // 3b. Trova un veicolo compatibile per tipo patente e cambio
    const compatibleVehicles = veicoli.filter(v => {
      const isGearboxMatch = v.cambio_manuale ? (updates.cambio === 'manuale') : (updates.cambio === 'automatico');
      const isMoto = ['AM', 'A1', 'A2', 'A'].includes(currentPatenteTipo);
      const isLicenseMatch = isMoto ? ['AM', 'A1', 'A2', 'A'].includes(v.tipo_patente) : v.tipo_patente === currentPatenteTipo;
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
        const isMoto = ['AM', 'A1', 'A2', 'A'].includes(currentPatenteTipo);
        const isLicenseMatch = isMoto ? ['AM', 'A1', 'A2', 'A'].includes(veh.tipo_patente) : veh.tipo_patente === currentPatenteTipo;
        
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

  const currentPatenteTipo = useMemo(() => {
    const p = patenti.find(p => p.id === form.patente_id);
    return p ? p.tipo : 'B';
  }, [form.patente_id, patenti]);

  const isMoto = useMemo(() => {
    return ['AM', 'A1', 'A2', 'A'].includes(currentPatenteTipo);
  }, [currentPatenteTipo]);

  const availableVeicoli = useMemo(() => {
    // Filter by slots first
    const slotAvailable = veicoli.filter(v => availableSlots.vehicle_ids.includes(v.id));
    
    // Filter by Patente compatibility
    const isVehMoto = ['AM', 'A1', 'A2', 'A'].includes(currentPatenteTipo);
    const compatibleWithPatente = slotAvailable.filter(v => isVehMoto ? ['AM', 'A1', 'A2', 'A'].includes(v.tipo_patente) : v.tipo_patente === currentPatenteTipo);

    if (!selectedIstruttore) return compatibleWithPatente;
    
    // Within compatible vehicles, prioritize instructor's default vehicle
    const instrDefaultId = selectedIstruttore.veicolo_id;
    
    return compatibleWithPatente.sort((a, b) => {
      if (a.id === instrDefaultId) return -1;
      if (b.id === instrDefaultId) return 1;
      return 0;
    });
  }, [veicoli, selectedIstruttore, availableSlots.vehicle_ids, currentPatenteTipo]);

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
  
  const filteredImpegniNames = useMemo(() => {
    if (!nomeImpegno.trim()) return impegniNames;
    const q = nomeImpegno.toLowerCase();
    return impegniNames.filter(name => name.toLowerCase().includes(q));
  }, [impegniNames, nomeImpegno]);

  const handleHoraFineChange = (newFine: string) => {
    try {
      const [startH, startM] = form.ora.split(':').map(Number);
      const [endH, endM] = newFine.split(':').map(Number);
      
      const start = new Date();
      start.setHours(startH, startM, 0, 0);
      
      const end = new Date();
      end.setHours(endH, endM, 0, 0);
      
      let diff = (end.getTime() - start.getTime()) / 1000 / 60;
      if (diff < 0) diff += 24 * 60; 
      
      setForm(prev => ({ ...prev, durata: diff }));
      if (diff === 30) setDurationMode('30');
      else if (diff === 60) setDurationMode('60');
      else setDurationMode('custom');
    } catch (err) {
      console.error(err);
    }
  };

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
    if (!isImpegno && !form.cliente_id) return alert('Seleziona un cliente');
    if (isImpegno && !nomeImpegno.trim()) return alert('Inserisci il nome dell\'impegno');
    if (!form.istruttore_id) return alert('Seleziona un istruttore');
    
    // Strict overlap validation before submitting
    if (!availableSlots.instructor_ids.includes(form.istruttore_id)) {
      return alert("L'istruttore è già impegnato in questo orario.");
    }
    if (!isImpegno && form.veicolo_id && !availableSlots.vehicle_ids.includes(form.veicolo_id)) {
      return alert("Il veicolo è già in uso in questo orario.");
    }
    if (!isImpegno && form.cliente_id && availableSlots.busy_client_ids.includes(form.cliente_id)) {
      return alert("Il cliente ha già un'altra guida in questo orario.");
    }
    
    setLoading(true);
    setServerError(null);
    try {
      const startISO = new Date(`${form.data}T${form.ora}`).toISOString();
      const finalClienteId = isImpegno ? null : form.cliente_id;
      const payload: any = {
        cliente_id: finalClienteId,
        is_impegno: isImpegno,
        nome_impegno: isImpegno ? nomeImpegno : null,
        istruttore_id: form.istruttore_id,
        veicolo_id: isImpegno ? null : (form.veicolo_id || null),
        data: startISO,
        data_solo: form.data,
        durata: form.durata,
        stato: form.stato,
        note: form.note || null,
        patente_id: isImpegno ? null : (form.patente_id || null),
        importo: null,
        send_email: sendEmail && !isImpegno,
        send_whatsapp: !isImpegno,
        email_fallback: emailFallback || null,
        preferenza_cambio: isImpegno ? null : form.cambio,
      };

      if (!navigator.onLine) {
        // Modalità OFFLINE
        await addToOfflineQueue('appuntamento', appointmentId ? 'update' : 'create', {
          ...(appointmentId ? { id: appointmentId, data: payload } : payload)
        });
        
        showToast('Sei offline. Le modifiche sono state salvate e verranno sincronizzate appena tornerà la connessione.', 'info');
        setLoading(false);
        onSuccess?.();
        return;
      }

      const result = appointmentId ? await updateAppointmentAction(appointmentId, payload) : await createAppointmentAction(payload);
      
      if (result && result.error) {
        showToast(result.error, 'error');
        setServerError(result.error);
        setLoading(false);
        return;
      }
      
      let successMsg = appointmentId ? 'Appuntamento aggiornato!' : 'Appuntamento creato!';
      if (result.notificationSent) {
        successMsg += ' ✉️ Email inviata.';
        showToast(successMsg, 'success');
      } else if (result.emailError) {
        showToast(successMsg, 'success');
        showToast(`Attenzione: ${result.emailError}`, 'info');
      } else {
        showToast(successMsg, 'success');
      }

      // 3. WhatsApp Redirect (Free notification)
      if (sendWhatsApp && selectedCliente?.telefono) {
        const dateStr = format(parseISO(form.data), 'dd/MM/yyyy', { locale: it });
        const timeStr = form.ora;
        const msg = `Ciao ${selectedCliente.nome}, ti confermo la guida per il ${dateStr} alle ore ${timeStr}. Ricordati che le guide vanno disdette almeno 24h prima. A presto!`;
        const waLink = generateWhatsAppLink(selectedCliente.telefono, false, msg);
        
        // Open WhatsApp in a new tab
        setTimeout(() => {
          window.open(waLink, '_blank');
        }, 1000); // Small delay to let the toast be seen
      }
      
      if (!appointmentId) {
        localStorage.setItem('lastApptDate', form.data);
        localStorage.setItem('lastApptTime', form.ora);
      }
      
      setLoading(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Submission error: ", error);
      setServerError(error.message || "Errore imprevisto durante il salvataggio.");
      setLoading(false);
    }
  };

  if (fetching) return <div className="py-24 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  const isView = mode === 'view';

  const handleNoteBlur = async (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!appointmentId) return;
    const newNote = e.target.value;
    if (newNote === form.note) return;
    
    setIsUpdatingNote(true);
    const result = await updateAppointmentNoteAction(appointmentId, newNote || null);
    setIsUpdatingNote(false);
    
    if (result.success) {
      setForm(prev => ({ ...prev, note: newNote }));
      showToast('Nota aggiornata con successo!', 'success');
    } else {
      showToast(result.error || 'Errore salvataggio nota', 'error');
    }
  };

  return (
    <div className="animate-fade-in p-1">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* TIPO APPUNTAMENTO TOGGLE */}
        <div className="flex bg-[#F4F4F4] p-1 rounded-2xl h-12 items-center shadow-inner">
          <button 
            type="button" 
            onClick={() => setIsImpegno(false)} 
            className={cn(
              "flex-1 h-10 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest", 
              !isImpegno ? "bg-white text-blue-600 shadow-sm border border-zinc-100" : "text-zinc-400"
            )}
          >
            Guida Cliente
          </button>
          <button 
            type="button" 
            onClick={() => setIsImpegno(true)} 
            className={cn(
              "flex-1 h-10 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest", 
              isImpegno ? "bg-white text-blue-600 shadow-sm border border-zinc-100" : "text-zinc-400"
            )}
          >
            Altro Impegno
          </button>
        </div>

        {/* CLIENTE O NOME IMPEGNO */}
        <div className="space-y-2">
          <label className={LABEL_CLS}>
            {isImpegno ? <ShieldCheck size={13} /> : <User size={13} />} 
            {isImpegno ? 'NOME IMPEGNO' : 'CLIENTE'}
          </label>
          
          {isImpegno ? (
            <div className="relative">
              <input
                required
                disabled={isView}
                value={nomeImpegno}
                onChange={(e) => { setNomeImpegno(e.target.value); setShowImpegniDropdown(true); }}
                onFocus={() => setShowImpegniDropdown(true)}
                className={isView ? VIEW_BLOCK_CLS : INPUT_CLS}
                placeholder="Es: Teoria B, Riunione, Ferie..."
              />
              {showImpegniDropdown && filteredImpegniNames.length > 0 && !isView && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[20px] shadow-2xl shadow-black/5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-[200px] overflow-y-auto p-2">
                    {filteredImpegniNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => { setNomeImpegno(name); setShowImpegniDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            isView ? (
            <div className={VIEW_BLOCK_CLS}>
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-baseline gap-2 min-w-0">
                  <p className="truncate font-bold">{selectedCliente ? `${selectedCliente.cognome} ${selectedCliente.nome}` : 'Nessun cliente'}</p>
                </div>
              </div>
              {selectedCliente && (
                <div className="flex gap-2 shrink-0 items-center">
                  {selectedCliente.telefono && (
                    <>
                      <a 
                        href={`tel:${selectedCliente.telefono.replace(/\D/g, '')}`} 
                        className="h-10 px-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-2 group"
                        title="Chiama"
                      >
                        <Phone size={14} className="shrink-0" />
                        <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider">{selectedCliente.telefono}</span>
                      </a>
                      <WhatsAppButton 
                        phone={selectedCliente.telefono} 
                        appointmentData={{ date: form.data, time: form.ora, duration: form.durata }}
                        showLabel={false}
                        variant="ghost"
                        className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors h-10 shadow-sm border border-emerald-100/50"
                      />
                    </>
                  )}
                  <Link href={`/clienti/${form.cliente_id}`} className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center shadow-sm border border-zinc-100 dark:border-zinc-800/50">
                    <ExternalLink size={14} />
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ClientAutocomplete 
                clients={clienti}
                onSelect={handleClienteChange}
                defaultValue={selectedCliente}
                className="flex-1"
                placeholder="Cerca per cognome o nome..."
              />
              <button
                type="button"
                onClick={() => setAddingCliente(true)}
                className="shrink-0 w-12 h-12 bg-purple-50 text-purple-600 rounded-[16px] flex items-center justify-center hover:bg-purple-100 transition-all border border-purple-100/50"
                title="Aggiungi nuovo cliente"
              >
                  <Plus size={20} />
                </button>
              </div>
            )
          )}
          {isView && appointmentId && (
            <div className="flex justify-center gap-3 mb-4 mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
              {/* MODIFICA */}
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center hover:bg-blue-100 transition-all active:scale-95 shadow-sm border border-blue-100/50 dark:border-blue-900/30"
                title="Modifica"
              >
                <Pencil size={18} />
              </button>

              {/* PRONTO PER ESAME */}
              {!isImpegno && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!form.cliente_id) return;
                    setIsExamModalOpen(true);
                  }}
                  className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-100 transition-all active:scale-95 shadow-sm border border-emerald-100/50 dark:border-emerald-900/30"
                  title="Pronto per Esame"
                >
                  <GraduationCap size={18} />
                </button>
              )}

              {/* ANNULLA */}
              <ConfirmBubble
                title="Annulla appuntamento"
                message="Vuoi annullare questa guida? L'azione è reversibile solo manualmente."
                confirmLabel="Annulla Guida"
                onConfirm={async () => {
                  setLoading(true); 
                  if (!navigator.onLine) {
                    await addToOfflineQueue('appuntamento', 'cancel', { id: appointmentId });
                    showToast('Sei offline. Appuntamento annullato in locale.', 'info');
                    onSuccess();
                    return;
                  }
                  const result = await cancelAppointmentAction(appointmentId!); 
                  if (result.success) {
                    showToast('Appuntamento annullato', 'info');
                    onSuccess(); 
                  } else {
                    showToast(result.error || 'Errore durante l\'annullamento', 'error');
                    setLoading(false);
                  }
                }}
                trigger={
                  <button 
                    type="button" 
                    disabled={form.stato === 'annullato'}  
                    className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center hover:bg-orange-100 transition-all active:scale-95 disabled:opacity-30 shadow-sm border border-orange-100/50 dark:border-orange-900/30"
                    title="Annulla"
                  >
                    <X size={18} />
                  </button>
                }
              />

              {/* ELIMINA */}
              <ConfirmBubble
                title="Elimina definitivamente"
                message="Sei sicuro di voler eliminare questo record? Non potrai tornare indietro."
                confirmLabel="Elimina"
                onConfirm={async () => {
                  setLoading(true); 
                  if (!navigator.onLine) {
                    await addToOfflineQueue('appuntamento', 'delete', { id: appointmentId });
                    showToast('Sei offline. Appuntamento eliminato in locale.', 'info');
                    onSuccess();
                    return;
                  }
                  const result = await deleteAppointmentAction(appointmentId!); 
                  if (result.success) {
                    showToast('Appuntamento eliminato definitivamente', 'info');
                    onSuccess(); 
                  } else {
                    showToast(result.error || 'Errore durante l\'eliminazione', 'error');
                    setLoading(false);
                  }
                }}
                trigger={
                  <button
                    type="button"
                    className="w-10 h-10 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all active:scale-95 shadow-sm border border-red-100/50 dark:border-red-900/30"
                    title="Elimina"
                  >
                    <Trash2 size={18} />
                  </button>
                }
              />

              {/* AGGIUNGI AL CALENDARIO */}
              <a
                href={`/api/calendar?id=${appointmentId}`}
                className="w-10 h-10 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-xl flex items-center justify-center hover:bg-violet-100 transition-all active:scale-95 shadow-sm border border-violet-100/50 dark:border-violet-900/30"
                title="Aggiungi al calendario"
                target="_blank"
                rel="noopener noreferrer"
              >
                <CalendarPlus size={18} />
              </a>
            </div>
          )}

          {/* NOTE (Auto-resizing) - Moved here if IS Impegno */}
          {isImpegno && (
            <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 group">
              <div className="flex justify-between items-center">
                <label className={LABEL_CLS}>📝 NOTE</label>
                <div className="flex items-center gap-1">
                  {isUpdatingNote && <Loader2 className="animate-spin text-blue-500 mr-2" size={12} />}
                  
                  {isView && (
                    <div className="flex gap-1 opacity-100 transition-opacity">
                      {!isEditingNote && form.note && (
                         <>
                           <button 
                             type="button" 
                             onClick={() => setIsEditingNote(true)}
                             className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                             title="Modifica nota"
                           >
                             <Pencil size={14} />
                           </button>
                           
                           <ConfirmBubble
                             title="Elimina nota"
                             message="Vuoi cancellare questa nota?"
                             confirmLabel="Elimina"
                             onConfirm={async () => {
                               setIsUpdatingNote(true);
                               const res = await updateAppointmentNoteAction(appointmentId!, null);
                               setIsUpdatingNote(false);
                               if (res.success) {
                                 setForm(prev => ({ ...prev, note: '' }));
                                 showToast('Nota eliminata', 'success');
                                onSuccess();
                               }
                             }}
                             trigger={
                               <button 
                                 type="button" 
                                 className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                                 title="Elimina nota"
                               >
                                 <Trash2 size={14} />
                               </button>
                             }
                           />
                         </>
                      )}
                      {(isEditingNote || !form.note) && (
                        <button 
                          type="button" 
                          onClick={async () => {
                            if (!noteRef.current) return;
                            setIsUpdatingNote(true);
                            const res = await updateAppointmentNoteAction(appointmentId!, noteRef.current.value);
                            setIsUpdatingNote(false);
                            if (res.success) {
                              setForm(prev => ({ ...prev, note: noteRef.current?.value || '' }));
                              setIsEditingNote(false);
                              showToast('Nota salvata', 'success');
                              onSuccess();
                            }
                          }}
                          className="p-1.5 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
                          title="Salva nota"
                        >
                          <Save size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {(isEditingNote || !form.note || !isView) ? (
                <textarea 
                  ref={noteRef}
                  rows={1} 
                  defaultValue={form.note} 
                  onChange={(e) => {
                    if (!isView) setForm(prev => ({ ...prev, note: e.target.value }));
                  }}
                  className={cn(
                    INPUT_CLS,
                    'resize-none py-4 leading-relaxed transition-all rounded-[16px] px-4 text-sm font-semibold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 w-full min-h-[48px]',
                    isView && "bg-white border-blue-100 ring-2 ring-blue-500/5 shadow-inner"
                  )} 
                  placeholder="Note aggiuntive per l'impegno..." 
                />
              ) : (
                <div 
                  onClick={() => setIsEditingNote(true)}
                  className="w-full bg-[#F4F4F4]/50 border border-transparent rounded-[16px] px-4 py-3 text-sm font-semibold text-zinc-600 italic cursor-pointer hover:bg-white hover:border-zinc-200 transition-all min-h-[48px] flex items-center"
                >
                  {form.note}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Quick-Add Cliente */}
        <Modal 
          isOpen={addingCliente} 
          onClose={() => setAddingCliente(false)} 
          title="Veloce: Nuovo Cliente"
        >
          <SchedaClienteForm
            patenti={patenti}
            onCancel={() => setAddingCliente(false)}
            onSuccess={async (newId) => {
              // Refresh client list
              const { data } = await supabase.from('clienti').select('*').order('cognome');
              const sorted = data ?? [];
              setClienti(sorted);
              
              const newClient = (sorted as Cliente[]).find((c: Cliente) => c.id === newId);
              if (newClient) {
                handleClienteChange(newClient);
              }
              setAddingCliente(false);
              showToast('Cliente aggiunto e selezionato', 'success');
            }}
          />
        </Modal>

        {/* DATA E ORARI */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-end">
          <div className="space-y-2 w-full sm:w-[170px] shrink-0">
            <label className={LABEL_CLS}>📅 DATA</label>
            {isView ? (
              <div className={VIEW_BLOCK_CLS}>{format(parseISO(form.data), 'dd MMM yyyy', { locale: it })}</div>
            ) : (
              <DatePicker selected={form.data ? new Date(form.data) : new Date()} onChange={(date) => date && setForm(prev => ({ ...prev, data: date.toISOString().split('T')[0] }))} required />
            )}
          </div>
          <div className="space-y-2 flex-1 w-full min-w-[80px]">
            <label className={LABEL_CLS}>🕒 INIZIO</label>
            {isView ? (
              <div className={VIEW_BLOCK_CLS}>{form.ora}</div>
            ) : (
              <Select
                options={TIME_OPTIONS.map(t => ({ id: t, label: t }))}
                value={form.ora}
                onChange={(val: string) => setForm(prev => ({ ...prev, ora: val }))}
                className="w-full"
              />
            )}
          </div>
          <div className="space-y-2 flex-1 w-full min-w-[100px]">
            <label className={LABEL_CLS}><Clock size={13} /> DURATA</label>
            {isView ? (
              <div className={VIEW_BLOCK_CLS}>{form.durata} min</div>
            ) : durationMode !== 'custom' ? (
              <Select
                options={[
                  { id: '30', label: '30 min' },
                  { id: '60', label: '60 min' },
                  { id: 'custom', label: 'Personalizzato' }
                ]}
                value={durationMode}
                onChange={(val) => {
                  if (val === 'custom') {
                    setDurationMode('custom');
                  } else {
                    const numVal = Number(val);
                    setDurationMode(val as '30' | '60');
                    setForm(prev => ({ ...prev, durata: numVal }));
                  }
                }}
              />
            ) : (
              <div className="flex gap-1">
                <input 
                  type="number" 
                  title="Minuti" 
                  autoFocus 
                  value={form.durata} 
                  onChange={(e) => setForm(prev => ({ ...prev, durata: Number(e.target.value) }))} 
                  className={cn(INPUT_CLS, "px-2 text-center")} 
                />
                <button 
                  type="button" 
                  onClick={() => { setDurationMode('60'); setForm(prev => ({ ...prev, durata: 60 })); }} 
                  className="w-8 h-12 rounded-[16px] bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-all flex items-center justify-center shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2 flex-1 w-full min-w-[80px]">
            <label className={LABEL_CLS}>🏁 FINE</label>
            {isView ? (
              <div className={cn(VIEW_BLOCK_CLS, 'text-blue-600 font-bold border-blue-50 bg-blue-50/20 justify-center')}>
                {oraFine}
              </div>
            ) : (
              <Select
                options={TIME_OPTIONS.map(t => ({ id: t, label: t }))}
                value={oraFine}
                onChange={handleHoraFineChange}
                className="w-full text-blue-600 font-bold"
              />
            )}
          </div>
        </div>

        {/* NOTE (Auto-resizing) - Moved here if NOT Impegno, or moved up if IS Impegno */}
        {!isImpegno && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 group">
            <div className="flex justify-between items-center">
              <label className={LABEL_CLS}>📝 NOTE</label>
              <div className="flex items-center gap-1">
                {isUpdatingNote && <Loader2 className="animate-spin text-blue-500 mr-2" size={12} />}
                
                {isView && (
                  <div className="flex gap-1 opacity-100 transition-opacity">
                    {!isEditingNote && form.note && (
                       <>
                         <button 
                           type="button" 
                           onClick={() => setIsEditingNote(true)}
                           className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                           title="Modifica nota"
                         >
                           <Pencil size={14} />
                         </button>
                         
                         <ConfirmBubble
                           title="Elimina nota"
                           message="Vuoi cancellare questa nota?"
                           confirmLabel="Elimina"
                           onConfirm={async () => {
                             setIsUpdatingNote(true);
                             const res = await updateAppointmentNoteAction(appointmentId!, null);
                             setIsUpdatingNote(false);
                             if (res.success) {
                               setForm(prev => ({ ...prev, note: '' }));
                               showToast('Nota eliminata', 'success');
                             }
                           }}
                           trigger={
                             <button 
                               type="button" 
                               className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                               title="Elimina nota"
                             >
                               <Trash2 size={14} />
                             </button>
                           }
                         />
                       </>
                    )}
                    {(isEditingNote || !form.note) && (
                      <button 
                        type="button" 
                        onClick={async () => {
                          if (!noteRef.current) return;
                          setIsUpdatingNote(true);
                          const res = await updateAppointmentNoteAction(appointmentId!, noteRef.current.value);
                          setIsUpdatingNote(false);
                          if (res.success) {
                            setForm(prev => ({ ...prev, note: noteRef.current?.value || '' }));
                            setIsEditingNote(false);
                            showToast('Nota salvata', 'success');
                            onSuccess();
                          }
                        }}
                        className="p-1.5 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
                        title="Salva nota"
                      >
                        <Save size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(isEditingNote || !form.note || !isView) ? (
              <textarea 
                ref={noteRef}
                rows={1} 
                defaultValue={form.note} 
                onChange={(e) => {
                  if (!isView) setForm(prev => ({ ...prev, note: e.target.value }));
                }}
                className={cn(
                  INPUT_CLS,
                  'resize-none py-4 leading-relaxed transition-all rounded-[16px] px-4 text-sm font-semibold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 w-full min-h-[48px]',
                  isView && "bg-white border-blue-100 ring-2 ring-blue-500/5 shadow-inner"
                )} 
                placeholder="Note aggiuntive..." 
              />
            ) : (
              <div 
                onClick={() => setIsEditingNote(true)}
                className="w-full bg-[#F4F4F4]/50 border border-transparent rounded-[16px] px-4 py-3 text-sm font-semibold text-zinc-600 italic cursor-pointer hover:bg-white hover:border-zinc-200 transition-all min-h-[48px] flex items-center"
              >
                {form.note}
              </div>
            )}
          </div>
        )}

        {/* PATENTE (Solo per Guida Cliente) */}
        {!isImpegno && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <label className={LABEL_CLS}><ShieldCheck size={13} /> PATENTE</label>
            {isView ? (
              <div className={VIEW_BLOCK_CLS}>{patenti.find(p => p.id === form.patente_id)?.tipo || 'B'}</div>
            ) : (
              <Select
                options={patenti.map(p => ({ id: p.id, label: p.tipo }))}
                value={form.patente_id}
                onChange={(val: string) => setForm(prev => ({ ...prev, patente_id: val }))}
                placeholder="Seleziona Patente"
              />
            )}
          </div>
        )}

        {/* ISTRUTTORE */}
        <div className="space-y-2">
          <label className={LABEL_CLS}>👤 ISTRUTTORE</label>
          {isView ? (
              <div className={VIEW_BLOCK_CLS}>
              <div className="w-2.5 h-2.5 rounded-full mr-3 shrink-0" style={{ backgroundColor: selectedIstruttore?.colore || '#3b82f6' }} />
              <span className="truncate">{selectedIstruttore ? `${selectedIstruttore.cognome} ${selectedIstruttore.nome}` : 'Non assegnato'}</span>
            </div>
          ) : (
            <Select
              options={istruttori.map(i => {
                const isBusy = !availableSlots.instructor_ids.includes(i.id);
                return {
                  id: i.id,
                  nome: i.nome,
                  cognome: i.cognome,
                  info: isBusy ? '(Occupato)' : '',
                  disabled: isBusy,
                  color: i.colore
                };
              })}
              value={form.istruttore_id}
              onChange={handleIstruttoreChange}
              placeholder="Seleziona istruttore..."
              searchable
            />
          )}
        </div>

        {/* VEICOLO E CAMBIO (Solo per Guida Cliente) */}
        {!isImpegno && (
          <div className={cn("grid gap-4 items-end", isMoto ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className={LABEL_CLS}><Car size={13} /> VEICOLO</label>
              {isView ? (
                <div className={VIEW_BLOCK_CLS}>{selectedVeicolo?.nome || 'Senza veicolo'}</div>
              ) : (
              <Select
                options={[
                  { id: '', label: 'Senza veicolo' },
                  ...availableVeicoli.map(v => {
                    const isVeicoloMoto = ['AM', 'A1', 'A2', 'A'].includes(v.tipo_patente);
                    return {
                      id: v.id,
                      label: isVeicoloMoto 
                        ? `${v.nome} - Patente ${v.tipo_patente} [${v.cambio_manuale ? 'M' : 'A'}] (${v.targa})` 
                        : `${v.nome} (${v.targa})`,
                      color: v.colore
                    };
                  })
                ]}
                value={form.veicolo_id}
                onChange={(val: string) => {
                  const veh = veicoli.find((v: Veicolo) => v.id === val);
                  setSelectedVeicolo(veh || null);
                  setForm(prev => ({ ...prev, veicolo_id: val }));
                }}
                placeholder="Seleziona veicolo..."
                searchable
              />
              )}
            </div>

            {isMoto && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className={LABEL_CLS}>⚙️ TIPO CAMBIO</label>
                <div className="flex bg-zinc-100 border border-zinc-100 p-1 rounded-2xl h-12 items-center shadow-sm">
                  {(['manuale', 'automatico'] as const).map(opt => (
                    <button key={opt} disabled={isView} type="button" onClick={() => setForm(prev => ({ ...prev, cambio: opt }))} className={cn("flex-1 h-10 rounded-xl text-[10px] font-black transition-all", form.cambio === opt ? "bg-white text-blue-600 shadow-sm border border-zinc-100" : "text-zinc-400 uppercase")}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {serverError && <p className="p-4 bg-red-50 text-red-600 text-[11px] font-black rounded-2xl border border-red-100 text-center uppercase tracking-wide">{serverError}</p>}

        {/* NOTIFICATION TOGGLE */}
        {!isImpegno && !isView && (
          <div className="pt-2 animate-in fade-in slide-in-from-top-2">
            <button
              type="button"
              onClick={() => setSendEmail(!sendEmail)}
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                sendEmail 
                  ? "bg-blue-50/50 border-blue-100 text-blue-700" 
                  : "bg-zinc-50 border-zinc-100 text-zinc-400"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                  sendEmail ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-zinc-200 text-zinc-400"
                )}>
                  <MessageCircle size={18} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-widest">Notifica Email</p>
                  <p className="text-[10px] font-medium opacity-70">Invia conferma all'allievo</p>
                </div>
              </div>
              <div className={cn(
                "w-12 h-6 rounded-full relative transition-all duration-300",
                sendEmail ? "bg-blue-600" : "bg-zinc-300"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300",
                  sendEmail ? "left-7" : "left-1"
                )} />
              </div>
            </button>

            {sendEmail && selectedCliente && !selectedCliente.email && (
              <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-2">
                  ⚠️ Il cliente non ha un'email. Inseriscila per inviare:
                </p>
                <input
                  type="email"
                  required
                  placeholder="Inserisci email cliente..."
                  className="w-full bg-white border border-amber-200 rounded-xl px-4 h-11 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                  value={emailFallback}
                  onChange={(e) => setEmailFallback(e.target.value)}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setSendWhatsApp(!sendWhatsApp)}
              className={cn(
                "hidden w-full items-center justify-between p-4 rounded-2xl border transition-all mt-3",
                sendWhatsApp 
                  ? "bg-emerald-50/50 border-emerald-100 text-emerald-700" 
                  : "bg-zinc-50 border-zinc-100 text-zinc-400"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                  sendWhatsApp ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "bg-zinc-200 text-zinc-400"
                )}>
                  <MessageCircle size={18} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-widest">Notifica WhatsApp</p>
                  <p className="text-[10px] font-medium opacity-70">Apri invio rapido conferma</p>
                </div>
              </div>
              <div className={cn(
                "w-12 h-6 rounded-full relative transition-all duration-300",
                sendWhatsApp ? "bg-emerald-600" : "bg-zinc-300"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300",
                  sendWhatsApp ? "left-7" : "left-1"
                )} />
              </div>
            </button>
          </div>
        )}

        {/* BOTTOM ACTIONS */}
        <div className="pt-6">
          {isView ? (
            <div className="flex flex-col gap-3">
              {/* Pronto per Esame Modal */}
              {!isImpegno && (
                  <AssignExamSessionModal 
                    isOpen={isExamModalOpen}
                    onClose={() => setIsExamModalOpen(false)}
                    clienteId={form.cliente_id}
                    onSuccess={() => {
                      showToast('Allievo pronto per esame!', 'success');
                      onSuccess();
                    }}
                  />
              )}
              
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
