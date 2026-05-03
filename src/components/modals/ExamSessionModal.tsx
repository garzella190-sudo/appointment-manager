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
  Layout
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Cliente, Istruttore, Veicolo, SessioneEsame } from '@/lib/database.types';
import { ConfirmBubble } from '@/components/ConfirmBubble';
import { createAppointmentAction } from '@/actions/appointments';
import { deleteAppointmentAction } from '@/actions/appointment_actions';

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
  
  // Refined states
  const [activeSection, setActiveSection] = useState<Section>('info');
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
      const [sRes, cRes, iRes, vRes] = await Promise.all([
        supabase.from('sessioni_esame').select('*').eq('id', sessionId).single(),
        supabase.from('clienti').select('*, patenti(tipo)').eq('sessione_esame_id', sessionId),
        supabase.from('istruttori').select('*').order('cognome'),
        supabase.from('veicoli').select('*').order('nome')
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
          .select('*, patenti(tipo)')
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
          await supabase.from('appuntamenti').update({
            inizio: `${editForm.data}T${editForm.ora_inizio}`,
            fine: format(new Date(new Date(`${editForm.data}T${editForm.ora_inizio}`).getTime() + editForm.durata * 60000), "yyyy-MM-dd'T'HH:mm:ss"),
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
    const { error } = await supabase.from('clienti')
      .update({ 
        pronto_esame: true,
        sessione_esame_id: null, 
        bocciato: true 
      })
      .eq('id', clienteId);
    
    if (!error) {
      showToast('Allievo segnato come respinto.', 'info');
      setCandidates(prev => prev.filter(c => c.id !== clienteId));
      onSuccess();
    }
  };

  const handlePromosso = async (clienteId: string) => {
    const { error } = await supabase.from('clienti')
      .update({ 
        archiviato: true,
        pronto_esame: false,
        sessione_esame_id: null,
        bocciato: false 
      })
      .eq('id', clienteId);
    
    if (!error) {
      showToast('Allievo promosso e archiviato!', 'success');
      setCandidates(prev => prev.filter(c => c.id !== clienteId));
      onSuccess();
    }
  };

  const toggleInstructor = async (istrId: string) => {
    if (!session) return;
    const isAssigned = session.istruttori_ids.includes(istrId);
    let newIds = [...session.istruttori_ids];

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
      // Create new appointment
      await createAppointmentAction({
        istruttore_id: istrId,
        is_impegno: true,
        nome_impegno: 'Esame di guida',
        data: `${session.data}T${session.ora_inizio || '08:30'}`,
        durata: session.durata || 180,
        stato: 'programmato',
        veicolo_id: null,
        importo: null,
        note: '',
        sessione_esame_id: session.id
      });
    }

    const { error } = await supabase.from('sessioni_esame')
      .update({ istruttori_ids: newIds })
      .eq('id', session.id);
    
    if (!error) {
      setSession({ ...session, istruttori_ids: newIds });
      showToast(isAssigned ? 'Istruttore rimosso' : 'Istruttore aggiunto', 'success');
      onSuccess();
    }
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
      showToast('Allievo aggiunto alla seduta', 'success');
      fetchData();
      setShowCandidateSearch(false);
      setCandidateSearch('');
      onSuccess();
    }
  };

  const changeSection = (section: Section) => {
    if (isEditingInfo && activeSection === 'info' && section !== 'info') {
      saveSessionInfo();
    }
    setActiveSection(section);
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
                    <button 
                      onClick={() => setIsEditingInfo(true)}
                      className="col-span-full h-12 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center gap-2 border border-sky-100 dark:border-sky-500/20 hover:bg-sky-100 transition-all"
                    >
                      <Edit3 size={18} /> <span className={BUTTON_TEXT_CLS}>Modifica Dettagli</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SEZIONE 2: ISTRUTTORI */}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allIstruttori.map(istr => {
                    const isAssigned = session?.istruttori_ids.includes(istr.id);
                    return (
                      <button
                        key={istr.id}
                        onClick={() => toggleInstructor(istr.id)}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-2xl border transition-all text-left",
                          isAssigned 
                            ? "bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-500/20" 
                            : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                        )}
                      >
                        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: isAssigned ? 'white' : istr.colore }} />
                        <span className="text-xs font-black uppercase truncate">{istr.cognome}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SEZIONE 3: VEICOLI */}
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
                    Mezzi
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

          {/* SEZIONE 4: CANDIDATI */}
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
                      {candidates.length} Assegnati
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

                  {showCandidateSearch && candidateSearch && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl z-50 p-2 max-h-[250px] overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2">
                      {availableCandidates.filter(c => 
                        `${c.nome} ${c.cognome}`.toLowerCase().includes(candidateSearch.toLowerCase())
                      ).map(c => (
                        <button
                          key={c.id}
                          onClick={() => assignCandidate(c.id)}
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
                        `${c.nome} ${c.cognome}`.toLowerCase().includes(candidateSearch.toLowerCase())
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
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePromosso(c.id)}
                          className="flex-1 px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center gap-2 border border-emerald-100/50 dark:border-emerald-500/20 active:scale-95 transition-all"
                        >
                          <CheckCircle2 size={16} strokeWidth={3} />
                          <span className={BUTTON_TEXT_CLS}>Promosso</span>
                        </button>
                        <button
                          onClick={() => handleRespinto(c.id)}
                          className="flex-1 px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center gap-2 border border-red-100/50 dark:border-red-500/20 active:scale-95 transition-all"
                        >
                          <XCircle size={16} strokeWidth={3} />
                          <span className={BUTTON_TEXT_CLS}>Respinto</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
