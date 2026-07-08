'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/Modal';
import { createClient } from '@/utils/supabase/client';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  GraduationCap, 
  Users, 
  Car, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  UserCircle,
  ShieldCheck,
  ChevronRight,
  Search,
  Bike,
  Edit3,
  Save,
  X,
  Calendar,
  ChevronDown,
  Layout,
  UserMinus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Cliente, Istruttore, Veicolo, SessioneEsame } from '@/lib/database.types';
import { ConfirmBubble } from '@/components/ConfirmBubble';
import { createAppointmentAction } from '@/actions/appointments';
import { deleteAppointmentAction } from '@/actions/appointment_actions';
import { registraEsitoEsameAction } from '@/actions/clienti';

const supabase = createClient();

interface ExamSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sessionId: string;
}

type Section = 'info' | 'istruttori' | 'veicoli' | 'candidati';

export default function ExamSessionModal({
  isOpen,
  onClose,
  onSuccess,
  sessionId
}: ExamSessionModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessioneEsame | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [allIstruttori, setAllIstruttori] = useState<Istruttore[]>([]);
  const [allVeicoli, setAllVeicoli] = useState<Veicolo[]>([]);
  const [sessionAppointments, setSessionAppointments] = useState<any[]>([]);
  
  // Refined states
  const [activeSection, setActiveSection] = useState<Section | null>('info');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({
    nome: '',
    data: '',
    ora_inizio: '',
    durata: 180,
    esaminatore: ''
  });
  
  const [candidateSearch, setCandidateSearch] = useState('');
  const [availableCandidates, setAvailableCandidates] = useState<any[]>([]);
  const [showCandidateSearch, setShowCandidateSearch] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes, iRes, vRes, aptRes] = await Promise.all([
        supabase.from('sessioni_esame').select('*').eq('id', sessionId).single(),
        supabase.from('clienti').select('*, patenti(tipo, veicoli_abilitati)').eq('sessione_esame_id', sessionId),
        supabase.from('istruttori').select('*').order('cognome'),
        supabase.from('veicoli').select('*').order('nome'),
        supabase.from('appuntamenti').select('*, clienti(id, nome, cognome, patenti(tipo))').eq('sessione_esame_id', sessionId)
      ]);

      if (sRes.data) {
        const sData = sRes.data;
        sData.istruttori_ids = sData.istruttori_ids || [];
        sData.veicoli_ids = sData.veicoli_ids || [];
        setSession(sData);
        setEditForm({
          nome: sData.nome || '',
          data: sData.data || '',
          ora_inizio: sData.ora_inizio || '08:30',
          durata: sData.durata || 180,
          esaminatore: sData.esaminatore || ''
        });
      }
      setCandidates(cRes.data || []);
      setAllIstruttori(iRes.data || []);
      setAllVeicoli(vRes.data || []);
      setSessionAppointments(aptRes.data || []);
    } catch (err) {
      console.error('Error fetching exam session data:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setActiveSection('info');
      setIsEditingInfo(false);
    }
  }, [isOpen, fetchData]);

  // Fetch available candidates (pronti per esame and not in another session)
  useEffect(() => {
    if (activeSection === 'candidati' && isOpen) {
      const fetchPronti = async () => {
        const { data } = await supabase
          .from('clienti')
          .select('*, patenti(tipo, veicoli_abilitati)')
          .eq('pronto_esame', true)
          .is('sessione_esame_id', null)
          .eq('archiviato', false)
          .order('cognome');
        setAvailableCandidates(data || []);
      };
      fetchPronti();
    }
  }, [activeSection, isOpen]);



  const saveSessionInfo = async () => {
    if (!session) return;
    const { error } = await supabase.from('sessioni_esame')
      .update({
        nome: editForm.nome,
        data: editForm.data,
        ora_inizio: editForm.ora_inizio,
        durata: editForm.durata,
        esaminatore: editForm.esaminatore
      })
      .eq('id', session.id);
    
    if (!error) {
      // Update associated appointments
      const { data: apts } = await supabase.from('appuntamenti')
        .select('id')
        .eq('sessione_esame_id', session.id);
      
      if (apts && apts.length > 0) {
        for (const apt of apts) {
          const startDate = new Date(`${editForm.data}T${editForm.ora_inizio}`);
          const endDate = new Date(startDate.getTime() + editForm.durata * 60000);
          await supabase.from('appuntamenti').update({
            data: startDate.toISOString(),
            data_solo: editForm.data,
            inizio: startDate.toISOString(),
            fine: endDate.toISOString(),
            durata: editForm.durata
          }).eq('id', apt.id);
        }
      }

      setSession({ ...session, ...editForm });
      setIsEditingInfo(false);
      showToast('Informazioni aggiornate', 'success');
      onSuccess();
    }
  };

  const handleRespinto = async (clienteId: string) => {
    setLoading(true);
    const res = await registraEsitoEsameAction(clienteId, session!.id, 'RESPINTO');
    if (res.success) {
      showToast('Allievo segnato come respinto.', 'info');
      setCandidates(prev => prev.filter(c => c.id !== clienteId));
      onSuccess();
    } else {
      showToast(res.error || 'Errore', 'error');
    }
    setLoading(false);
  };

  const handlePromosso = async (clienteId: string) => {
    setLoading(true);
    const res = await registraEsitoEsameAction(clienteId, session!.id, 'PROMOSSO');
    if (res.success) {
      showToast('Allievo promosso e archiviato!', 'success');
      setCandidates(prev => prev.filter(c => c.id !== clienteId));
      onSuccess();
    } else {
      showToast(res.error || 'Errore', 'error');
    }
    setLoading(false);
  };

  const handleAssente = async (clienteId: string) => {
    setLoading(true);
    const res = await registraEsitoEsameAction(clienteId, session!.id, 'ASSENTE');
    if (res.success) {
      showToast('Allievo segnato come assente.', 'info');
      setCandidates(prev => prev.filter(c => c.id !== clienteId));
      onSuccess();
    } else {
      showToast(res.error || 'Errore', 'error');
    }
    setLoading(false);
  };

  const toggleInstructor = async (istrId: string) => {
    if (!session) return;
    const isAssigned = session.istruttori_ids.includes(istrId);
    let newIds = [...session.istruttori_ids];
    let newVehicles = [...session.veicoli_ids];

    if (isAssigned) {
      newIds = newIds.filter(id => id !== istrId);
      // Delete appointment associated with this session for this instructor
      const { data: apts } = await supabase.from('appuntamenti')
        .select('id')
        .eq('sessione_esame_id', session.id)
        .eq('istruttore_id', istrId);
      
      if (apts && apts.length > 0) {
        await supabase.from('appuntamenti').delete().in('id', apts.map((a: any) => a.id));
      }
    } else {
      newIds.push(istrId);
      const istr = allIstruttori.find(i => i.id === istrId);
      
      if (istr?.veicolo_id && !session.veicoli_ids.includes(istr.veicolo_id)) {
        newVehicles.push(istr.veicolo_id);
      }

      // Create new appointment
      const startDateStr = `${session.data}T${session.ora_inizio || '08:30'}`;
      const startDate = new Date(startDateStr);
      await createAppointmentAction({
        istruttore_id: istrId,
        is_impegno: true,
        nome_impegno: 'Esame di guida',
        data: startDate.toISOString(),
        data_solo: session.data,
        durata: session.durata || 180,
        stato: 'programmato',
        veicolo_id: istr?.veicolo_id || null,
        importo: null,
        note: '',
        sessione_esame_id: session.id
      });
    }

    const { error } = await supabase.from('sessioni_esame')
      .update({ istruttori_ids: newIds, veicoli_ids: newVehicles })
      .eq('id', session.id);
    
    if (!error) {
      setSession({ ...session, istruttori_ids: newIds, veicoli_ids: newVehicles });
      showToast(isAssigned ? 'Istruttore rimosso' : 'Istruttore aggiunto', 'success');
      onSuccess();
    }
  };

  const updateInstructorTime = async (aptId: string, field: 'inizio' | 'durata' | 'fine', value: string | number) => {
    const apt = sessionAppointments.find(a => a.id === aptId);
    if (!apt) return;

    let updates: any = {};
    if (field === 'durata') {
       updates.durata = value;
       const d = new Date(apt.inizio);
       updates.fine = new Date(d.getTime() + (value as number) * 60000).toISOString();
    } else if (field === 'inizio') {
       const baseDate = session!.data;
       const newInizio = new Date(`${baseDate}T${value}`);
       updates.inizio = newInizio.toISOString();
       updates.fine = new Date(newInizio.getTime() + apt.durata * 60000).toISOString();
    } else if (field === 'fine') {
       const baseDate = session!.data;
       let newFine = new Date(`${baseDate}T${value}`);
       const newInizio = new Date(apt.inizio);
       let diffMins = Math.round((newFine.getTime() - newInizio.getTime()) / 60000);
       if (diffMins < 0) {
           // Handle crossing midnight
           newFine = new Date(newFine.getTime() + 24 * 60 * 60 * 1000);
           diffMins = Math.round((newFine.getTime() - newInizio.getTime()) / 60000);
       }
       updates.fine = newFine.toISOString();
       updates.durata = diffMins > 0 ? diffMins : 0;
    }
    
    setSessionAppointments(prev => prev.map(a => a.id === aptId ? { ...a, ...updates } : a));

    await supabase.from('appuntamenti').update(updates).eq('id', aptId);
    onSuccess();
  };

  const toggleVehicle = async (vehId: string) => {
    if (!session) return;
    const isAssigned = session.veicoli_ids.includes(vehId);
    let newIds = [...session.veicoli_ids];

    if (isAssigned) {
      newIds = newIds.filter(id => id !== vehId);
    } else {
      newIds.push(vehId);
    }

    const { error } = await supabase.from('sessioni_esame')
      .update({ veicoli_ids: newIds })
      .eq('id', session.id);
    
    if (!error) {
      setSession({ ...session, veicoli_ids: newIds });
      showToast(isAssigned ? 'Veicolo rimosso' : 'Veicolo aggiunto', 'success');
      onSuccess();
    }
  };

  const assignCandidate = async (clienteId: string) => {
    if (!session) return;
    const { error } = await supabase.from('clienti')
      .update({ sessione_esame_id: session.id })
      .eq('id', clienteId);
    
    if (!error) {
      const cand = availableCandidates.find(c => c.id === clienteId);
      if (cand && cand.patenti?.tipo && ['AM', 'A1', 'A2', 'A'].includes(cand.patenti.tipo.toUpperCase())) {
         const habilitatedIds = cand.patenti.veicoli_abilitati || [];
         let moto = allVeicoli.find(v => habilitatedIds.includes(v.id));
         
         if (!moto) {
           moto = allVeicoli.find(v => ['AM', 'A1', 'A2', 'A'].includes(v.tipo_patente?.toUpperCase() || ''));
         }

         if (moto && !session.veicoli_ids.includes(moto.id)) {
            const newVehicles = [...session.veicoli_ids, moto.id];
            await supabase.from('sessioni_esame').update({ veicoli_ids: newVehicles }).eq('id', session.id);
         }
      }

      showToast('Allievo aggiunto alla seduta', 'success');
      setShowCandidateSearch(false);
      setCandidateSearch('');
      onSuccess();
    }
  };

  const changeSection = (section: Section) => {
    if (isEditingInfo && activeSection === 'info' && section !== 'info') {
      saveSessionInfo();
    }
    setActiveSection(prev => prev === section ? null : section);
  };

  const LABEL_CLS = "text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2 block ml-1";
  const BUTTON_TEXT_CLS = "text-sm font-black uppercase tracking-wider";
  const INPUT_CLS = "w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl px-4 h-12 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-sky-500 transition-all";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={session?.nome || 'Gestione Esame'}>
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
      
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Clock className="animate-spin text-sky-500" size={32} />
          <p className="text-[10px] font-black uppercase text-zinc-400">Caricamento dettagli...</p>
        </div>
      ) : (
        <div className="space-y-4 pt-4 pb-6 no-scrollbar max-h-[80vh] overflow-y-auto">
          
          {/* SEZIONE 1: INFO GENERALI (EDITABILE) */}
          <div className={cn(
            "rounded-[32px] transition-all duration-300 overflow-hidden border border-zinc-100 dark:border-zinc-800",
            activeSection === 'info' ? "bg-zinc-50 dark:bg-zinc-900/50 p-6" : "bg-white dark:bg-zinc-900 p-4"
          )}>
            <button 
              onClick={() => changeSection('info')}
              className="w-full flex justify-between items-center group"
            >
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-all", activeSection === 'info' ? "bg-sky-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400")}>
                  <Layout size={20} />
                </div>
                <div className="text-left">
                  <h3 className={cn("font-black uppercase tracking-tight leading-none transition-all", activeSection === 'info' ? "text-xl text-zinc-900 dark:text-white" : "text-sm text-zinc-500")}>
                    {session?.nome}
                  </h3>
                  {activeSection !== 'info' && (
                    <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase">
                      {session?.data && format(new Date(session.data), 'd MMM yyyy', { locale: it })} • {session?.ora_inizio}
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown className={cn("transition-transform duration-300", activeSection === 'info' ? "rotate-180 text-sky-500" : "text-zinc-300")} size={20} />
            </button>

            {activeSection === 'info' && (
              <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-4">
                {isEditingInfo ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="col-span-full">
                      <label className={LABEL_CLS}>Nome Seduta</label>
                      <input 
                        className={INPUT_CLS}
                        value={editForm.nome}
                        onChange={e => setEditForm({...editForm, nome: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Data</label>
                      <input 
                        type="date"
                        className={INPUT_CLS}
                        value={editForm.data}
                        onChange={e => setEditForm({...editForm, data: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Ora Inizio</label>
                      <input 
                        type="time"
                        className={INPUT_CLS}
                        value={editForm.ora_inizio}
                        onChange={e => setEditForm({...editForm, ora_inizio: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Durata (min)</label>
                      <input 
                        type="number"
                        className={INPUT_CLS}
                        value={editForm.durata}
                        onChange={e => setEditForm({...editForm, durata: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Esaminatore</label>
                      <input 
                        className={INPUT_CLS}
                        value={editForm.esaminatore}
                        onChange={e => setEditForm({...editForm, esaminatore: e.target.value})}
                      />
                    </div>
                    <div className="col-span-full flex gap-2 pt-2">
                      <button 
                        onClick={saveSessionInfo}
                        className="flex-1 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                      >
                        <Save size={18} /> <span className={BUTTON_TEXT_CLS}>Salva Modifiche</span>
                      </button>
                      <button 
                        onClick={() => setIsEditingInfo(false)}
                        className="w-12 h-12 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-700">
                      <span className={LABEL_CLS}>Programmazione</span>
                      <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase">
                        {session?.data && format(new Date(session.data), 'EEEE d MMMM', { locale: it })}
                      </p>
                      <p className="text-[10px] font-bold text-sky-500 uppercase mt-1">Dalle {session?.ora_inizio} ({session?.durata} min)</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-700">
                      <span className={LABEL_CLS}>Esaminatore</span>
                      <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase truncate">
                        {session?.esaminatore || 'Non specificato'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SEZIONE 2: CANDIDATI */}
          <div className={cn(
            "rounded-[32px] transition-all duration-300 overflow-hidden border border-zinc-100 dark:border-zinc-800",
            activeSection === 'candidati' ? "bg-zinc-50 dark:bg-zinc-900/50 p-6" : "bg-white dark:bg-zinc-900 p-4"
          )}>
            <button 
              onClick={() => changeSection('candidati')}
              className="w-full flex justify-between items-center group"
            >
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-all", activeSection === 'candidati' ? "bg-emerald-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400")}>
                  <GraduationCap size={20} />
                </div>
                <div className="text-left">
                  <h3 className={cn("font-black uppercase tracking-tight leading-none transition-all", activeSection === 'candidati' ? "text-xl text-zinc-900 dark:text-white" : "text-sm text-zinc-500")}>
                    Candidati
                  </h3>
                  {activeSection !== 'candidati' && (
                    <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase">
                      {candidates.length + sessionAppointments.filter(a => a.note?.startsWith('ESITO ESAME:')).length} Totali
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown className={cn("transition-transform duration-300", activeSection === 'candidati' ? "rotate-180 text-emerald-500" : "text-zinc-300")} size={20} />
            </button>

            {activeSection === 'candidati' && (
              <div className="mt-6 space-y-6 animate-in fade-in slide-in-from-top-4">
                
                {/* Search / Add Bar */}
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input 
                        className={cn(INPUT_CLS, "pl-12 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700")}
                        placeholder="Cerca tra i pronti..."
                        value={candidateSearch}
                        onChange={e => setCandidateSearch(e.target.value)}
                        onFocus={() => setShowCandidateSearch(true)}
                      />
                    </div>
                    {showCandidateSearch && (
                      <button 
                        onClick={() => { setShowCandidateSearch(false); setCandidateSearch(''); }}
                        className="w-12 h-12 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-400"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>

                  {showCandidateSearch && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl z-50 p-2 max-h-[250px] overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2">
                      {availableCandidates.filter(c => 
                        !candidateSearch || `${c.nome} ${c.cognome}`.toLowerCase().includes(candidateSearch.toLowerCase())
                      ).map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            assignCandidate(c.id);
                            setShowCandidateSearch(false);
                            setCandidateSearch('');
                          }}
                          className="w-full text-left p-4 hover:bg-sky-50 dark:hover:bg-sky-500/10 rounded-[20px] transition-all flex items-center justify-between group"
                        >
                          <div>
                            <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase">{c.cognome} {c.nome}</p>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">Patente {c.patenti?.tipo}</p>
                          </div>
                          <Plus size={18} className="text-zinc-300 group-hover:text-sky-500" />
                        </button>
                      ))}
                      {availableCandidates.filter(c => 
                        !candidateSearch || `${c.nome} ${c.cognome}`.toLowerCase().includes(candidateSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="p-6 text-center text-xs font-bold text-zinc-400 uppercase">Nessun allievo pronto trovato</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Candidate List */}
                <div className="space-y-3">
                  {candidates.map(c => (
                    <div key={c.id} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 rounded-[28px] shadow-sm flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-[18px] bg-sky-50 dark:bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                            <GraduationCap size={24} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase flex items-center gap-2">
                              {c.cognome} {c.nome}
                              {c.bocciato && <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse shrink-0" />}
                            </h4>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">Patente {c.patenti?.tipo}</p>
                          </div>
                        </div>
                        <ConfirmBubble
                          title="Rimuovi"
                          message="Rimuovere l'allievo dalla seduta?"
                          confirmLabel="Rimuovi"
                          onConfirm={async () => {
                            const { error } = await supabase.from('clienti').update({ sessione_esame_id: null }).eq('id', c.id);
                            if (!error) {
                               setCandidates(prev => prev.filter(cand => cand.id !== c.id));
                               onSuccess();
                            }
                          }}
                          trigger={
                            <button className="p-2.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all">
                              <Trash2 size={18} />
                            </button>
                          }
                        />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handlePromosso(c.id)}
                          className="px-2 py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex flex-col items-center justify-center gap-1 border border-emerald-100/50 dark:border-emerald-500/20 active:scale-95 transition-all"
                        >
                          <CheckCircle2 size={16} strokeWidth={3} />
                          <span className="text-[10px] font-black uppercase tracking-wider">Promosso</span>
                        </button>
                        <button
                          onClick={() => handleRespinto(c.id)}
                          className="px-2 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl flex flex-col items-center justify-center gap-1 border border-red-100/50 dark:border-red-500/20 active:scale-95 transition-all"
                        >
                          <XCircle size={16} strokeWidth={3} />
                          <span className="text-[10px] font-black uppercase tracking-wider">Respinto</span>
                        </button>
                        <button
                          onClick={() => handleAssente(c.id)}
                          className="px-2 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl flex flex-col items-center justify-center gap-1 border border-zinc-200/50 dark:border-zinc-700/50 active:scale-95 transition-all"
                        >
                          <UserMinus size={16} strokeWidth={2.5} />
                          <span className="text-[10px] font-black uppercase tracking-wider">Assente</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Evaluated Candidates */}
                  {sessionAppointments.filter(a => a.note?.startsWith('ESITO ESAME:')).map(apt => {
                    const cand = apt.clienti;
                    if (!cand) return null;
                    const esito = apt.note.replace('ESITO ESAME: ', '');
                    let badgeColor = 'bg-zinc-100 text-zinc-500';
                    if (esito === 'PROMOSSO') badgeColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400';
                    else if (esito === 'RESPINTO') badgeColor = 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
                    else if (esito === 'ASSENTE') badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';

                    return (
                      <div key={apt.id} className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 p-4 rounded-[28px] flex items-center justify-between opacity-80">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-[18px] bg-zinc-200 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
                            <GraduationCap size={24} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase flex items-center gap-2">
                              {cand.cognome} {cand.nome}
                            </h4>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">Patente {cand.patenti?.tipo || '?'}</p>
                          </div>
                        </div>
                        <div className={cn("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider", badgeColor)}>
                          {esito}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {/* SEZIONE 3: ISTRUTTORI */}
          <div className={cn(
            "rounded-[32px] transition-all duration-300 overflow-hidden border border-zinc-100 dark:border-zinc-800",
            activeSection === 'istruttori' ? "bg-zinc-50 dark:bg-zinc-900/50 p-6" : "bg-white dark:bg-zinc-900 p-4"
          )}>
            <button 
              onClick={() => changeSection('istruttori')}
              className="w-full flex justify-between items-center group"
            >
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-all", activeSection === 'istruttori' ? "bg-amber-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400")}>
                  <Users size={20} />
                </div>
                <div className="text-left">
                  <h3 className={cn("font-black uppercase tracking-tight leading-none transition-all", activeSection === 'istruttori' ? "text-xl text-zinc-900 dark:text-white" : "text-sm text-zinc-500")}>
                    Istruttori
                  </h3>
                  {activeSection !== 'istruttori' && (
                    <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase">
                      {session?.istruttori_ids.length} Assegnati
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown className={cn("transition-transform duration-300", activeSection === 'istruttori' ? "rotate-180 text-amber-500" : "text-zinc-300")} size={20} />
            </button>

            {activeSection === 'istruttori' && (
              <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-4">
                
                {/* Istruttori Assegnati */}
                {allIstruttori.filter(istr => session?.istruttori_ids.includes(istr.id)).length > 0 && (
                  <div className="space-y-3">
                    <span className={LABEL_CLS}>Assegnati alla Seduta</span>
                    {allIstruttori.filter(istr => session?.istruttori_ids.includes(istr.id)).map(istr => {
                      const apt = sessionAppointments.find(a => a.istruttore_id === istr.id);
                      const oraInizioApt = apt ? format(new Date(apt.inizio), 'HH:mm') : session?.ora_inizio;
                              const oraFineApt = apt && apt.fine ? format(new Date(apt.fine), 'HH:mm') : '';
                              
                              return (
                                <div key={istr.id} className="bg-white dark:bg-zinc-800 border border-amber-500/30 rounded-3xl p-4 shadow-sm relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: istr.colore }} />
                                  <div className="pl-3 flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase">
                                        {istr.cognome} {istr.nome}
                                      </h4>
                                      <button
                                        onClick={() => toggleInstructor(istr.id)}
                                        className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                    
                                    {apt && (
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1 block mb-1">Ora Inizio</label>
                                          <input 
                                            type="time"
                                            value={oraInizioApt}
                                            onChange={e => updateInstructorTime(apt.id, 'inizio', e.target.value)}
                                            className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-xl px-3 h-10 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1 block mb-1">Ora Fine</label>
                                          <input 
                                            type="time"
                                            value={oraFineApt}
                                            onChange={e => updateInstructorTime(apt.id, 'fine', e.target.value)}
                                            className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-xl px-3 h-10 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                                          />
                                        </div>
                                      </div>
                                    )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Aggiungi Istruttore */}
                <div className="space-y-3 pt-2">
                  <span className={LABEL_CLS}>Aggiungi Istruttore</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {allIstruttori.filter(istr => !session?.istruttori_ids.includes(istr.id)).map(istr => (
                      <button
                        key={istr.id}
                        onClick={() => toggleInstructor(istr.id)}
                        className="flex items-center gap-2 p-3 rounded-2xl border transition-all text-left bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-sky-500 hover:text-sky-500"
                      >
                        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: istr.colore }} />
                        <span className="text-xs font-black uppercase truncate">
                          {istr.cognome} {istr.nome ? `${istr.nome[0]}.` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEZIONE 4: VEICOLI */}
          <div className={cn(
            "rounded-[32px] transition-all duration-300 overflow-hidden border border-zinc-100 dark:border-zinc-800",
            activeSection === 'veicoli' ? "bg-zinc-50 dark:bg-zinc-900/50 p-6" : "bg-white dark:bg-zinc-900 p-4"
          )}>
            <button 
              onClick={() => changeSection('veicoli')}
              className="w-full flex justify-between items-center group"
            >
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-all", activeSection === 'veicoli' ? "bg-indigo-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400")}>
                  <Car size={20} />
                </div>
                <div className="text-left">
                  <h3 className={cn("font-black uppercase tracking-tight leading-none transition-all", activeSection === 'veicoli' ? "text-xl text-zinc-900 dark:text-white" : "text-sm text-zinc-500")}>
                    Veicoli Impegnati
                  </h3>
                  {activeSection !== 'veicoli' && (
                    <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase">
                      {session?.veicoli_ids.length} In uso
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown className={cn("transition-transform duration-300", activeSection === 'veicoli' ? "rotate-180 text-indigo-500" : "text-zinc-300")} size={20} />
            </button>

            {activeSection === 'veicoli' && (
              <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allVeicoli.map(veh => {
                    const isAssigned = session?.veicoli_ids.includes(veh.id);
                    const isMoto = ['AM', 'A1', 'A2', 'A'].includes(veh.tipo_patente || '');
                    return (
                      <button
                        key={veh.id}
                        onClick={() => toggleVehicle(veh.id)}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-3xl border transition-all text-left",
                          isAssigned 
                            ? "bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-500/20" 
                            : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0", isAssigned ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-700")}>
                            {isMoto ? <Bike size={20} /> : <Car size={20} />}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase truncate">{veh.nome}</p>
                            <p className={cn("text-[9px] font-bold uppercase", isAssigned ? "opacity-70" : "text-zinc-400")}>{veh.targa}</p>
                          </div>
                        </div>
                        {isAssigned && <CheckCircle2 size={18} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={() => {
              changeSection('info');
              setIsEditingInfo(true);
            }}
            className="w-full mt-2 h-14 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-3xl flex items-center justify-center gap-2 border border-sky-100 dark:border-sky-500/20 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-all active:scale-[0.98]"
          >
            <Edit3 size={18} /> <span className={BUTTON_TEXT_CLS}>Modifica Dettagli Seduta</span>
          </button>
        </div>
      )}
    </Modal>
  );
}
