'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { GraduationCap, Users, Plus, Calendar as CalendarIcon, Trash2, CheckCircle2, UserCircle, Clock, Search, ChevronDown, Printer, XCircle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'next/navigation';
import { ConfirmBubble } from '@/components/ConfirmBubble';
import DatePicker from '@/components/DatePicker';
import { toggleProntoEsameAction } from '@/actions/clienti';
import { createAppointmentAction } from '@/actions/appointments';
import { deleteImpegniBySessionAction } from '@/actions/impegni';

const supabase = createClient();

export default function EsamiPage() {
  const { role, isAdmin, isSegreteria } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pronti' | 'sedute'>('pronti');
  const [loading, setLoading] = useState(true);
  const [pronti, setPronti] = useState<any[]>([]);
  const [notPronti, setNotPronti] = useState<any[]>([]);
  const [sedute, setSedute] = useState<any[]>([]);
  const [istruttori, setIstruttori] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddProntoModalOpen, setIsAddProntoModalOpen] = useState(false);
  const [searchQueryPronto, setSearchQueryPronto] = useState('');
  const [formData, setFormData] = useState({ 
    nome: '', 
    data: format(new Date(), 'yyyy-MM-dd'), 
    n_candidati: 0, 
    note: '',
    ora_inizio: '08:30',
    istruttori_ids: [] as string[]
  });
  
  // Stati per il dettaglio della seduta
  const [selectedSeduta, setSelectedSeduta] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [sessionCandidates, setSessionCandidates] = useState<any[]>([]);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  
  // Stati per l'assegnazione rapida dalla card allievo
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  
  // Stato per gestire il collasso delle schede allievo ed istruttori
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedInstructors, setExpandedInstructors] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedIds(newExpanded);
  };

  const toggleInstructor = (id: string) => {
    const newExpanded = new Set(expandedInstructors);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedInstructors(newExpanded);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [
      { data: pData },
      { data: npData },
      { data: sData },
      { data: iData }
    ] = await Promise.all([
      supabase.from('clienti')
        .select('*, patenti(tipo), sessioni_esame(nome, data), istruttori(id, nome, cognome, colore)')
        .eq('pronto_esame', true)
        .eq('archiviato', false)
        .order('data_pronto_esame', { ascending: false }),
      supabase.from('clienti')
        .select('*, patenti(tipo)')
        .eq('pronto_esame', false)
        .eq('archiviato', false)
        .order('cognome', { ascending: true }),
      supabase.from('sessioni_esame')
        .select('*, clienti(count)')
        .order('data', { ascending: true }),
      supabase.from('istruttori')
        .select('*')
        .order('cognome', { ascending: true })
    ]);

    setPronti(pData || []);
    setNotPronti(npData || []);
    setSedute(sData || []);
    setIstruttori(iData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSeduta = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const dbPayload = {
      nome: formData.nome,
      data: formData.data,
      n_candidati: formData.n_candidati,
      note: formData.note
    };

    let error;
    if (selectedSeduta) {
      const { error: err } = await supabase.from('sessioni_esame').update(dbPayload).eq('id', selectedSeduta.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('sessioni_esame').insert([dbPayload]);
      error = err;
    }
    setLoading(false);
    
    if (!error) {
      showToast(selectedSeduta ? 'Seduta aggiornata' : 'Seduta d\'esame creata', 'success');
      
      // LOGICA AUTOMAZIONE IMPEGNI (Solo Nuova Seduta o if needed)
      // Se è una nuova seduta, creiamo gli impegni per gli istruttori selezionati
      if (!selectedSeduta && formData.istruttori_ids.length > 0) {
        // Troviamo l'ID della seduta appena creata (serve una query se insert non ritorna l'oggetto, ma qui possiamo recuperarlo dal fetch o farlo tornare)
        const { data: newSession } = await supabase
          .from('sessioni_esame')
          .select('id')
          .eq('data', formData.data)
          .eq('nome', formData.nome)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (newSession) {
          for (const instrId of formData.istruttori_ids) {
            await createAppointmentAction({
              istruttore_id: instrId,
              is_impegno: true,
              nome_impegno: 'Esame',
              data: `${formData.data}T${formData.ora_inizio}`,
              durata: 180, // 3 ore come richiesto
              stato: 'programmato',
              veicolo_id: null,
              importo: null,
              note: `[SEDUTA_ID:${newSession.id}] Blocco automatico per esame ${formData.nome}`
            });
          }
        }
      }

      setIsModalOpen(false);
      setSelectedSeduta(null);
      setFormData({ 
        nome: '', 
        data: format(new Date(), 'yyyy-MM-dd'), 
        n_candidati: 0, 
        note: '',
        ora_inizio: '08:30',
        istruttori_ids: []
      });
      if (!selectedSeduta) setActiveTab('sedute'); 
      fetchData();
      router.refresh(); 
    } else {
      console.error('Errore operazione seduta:', error);
      showToast(`Errore: ${error.message}`, 'error');
    }
  };

  const handleDeleteSeduta = async (id: string) => {
    // 1. Eliminiamo i blocchi d'impegno associati
    await deleteImpegniBySessionAction(id);

    // 2. Eliminiamo la seduta
    const { error } = await supabase.from('sessioni_esame').delete().eq('id', id);
    if (!error) {
      showToast('Seduta (e impegni associati) eliminata', 'info');
      fetchData();
    }
  };

  const openDetailModal = async (seduta: any) => {
    setSelectedSeduta(seduta);
    setIsDetailModalOpen(true);
    // Fetch candidates for this session
    const { data } = await supabase
      .from('clienti')
      .select('*, patenti(tipo)')
      .eq('sessione_esame_id', seduta.id);
    setSessionCandidates(data || []);
  };

  const handleAssignCandidate = async (clienteId: string, sessionId?: string) => {
    const sId = sessionId || selectedSeduta?.id;
    if (!sId) return;

    // Se stiamo operando nel modale dettaglio, verifichiamo il limite
    if (selectedSeduta && sId === selectedSeduta.id) {
       if (sessionCandidates.length >= selectedSeduta.n_candidati) {
         return showToast('Limite massimo candidati raggiunto', 'error');
       }
    }

    const { error } = await supabase.from('clienti')
      .update({ sessione_esame_id: sId })
      .eq('id', clienteId);
    
    if (!error) {
      showToast('Allievo assegnato alla seduta', 'success');
      if (selectedSeduta && sId === selectedSeduta.id) {
        // Refresh local candidates del modale
        const { data } = await supabase
          .from('clienti')
          .select('*, patenti(tipo)')
          .eq('sessione_esame_id', selectedSeduta.id);
        setSessionCandidates(data || []);
      }
      setIsAssignModalOpen(false);
      setSelectedStudent(null);
      fetchData();
    }
  };

  const handleRemovePronto = async (id: string, removeSessionOnly = false) => {
    const updatePayload = removeSessionOnly 
      ? { sessione_esame_id: null }
      : { pronto_esame: false, data_pronto_esame: null, sessione_esame_id: null, istruttore_pronto_id: null };

    const { error } = await supabase.from('clienti')
      .update(updatePayload)
      .eq('id', id);
    if (!error) fetchData();
  };

  const handleAddPronto = async (clienteId: string) => {
    const res = await toggleProntoEsameAction(clienteId, true);
    if (res.success) {
      showToast('Allievo dichiarato pronto per esame!', 'success');
      setIsAddProntoModalOpen(false);
      fetchData();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="pt-6 px-4 md:px-8 pb-4 flex-shrink-0 animate-in fade-in duration-500">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
              <GraduationCap className="text-sky-500" size={32} />
              Esami
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest mt-1">Gestione allievi e sedute</p>
          </div>
          {(isAdmin || isSegreteria) && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-zinc-900 dark:bg-sky-500 text-white p-3 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all outline-none"
            >
              <Plus size={20} strokeWidth={3} />
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 md:px-8 pb-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex bg-white/50 dark:bg-zinc-900/50 p-1.5 rounded-[22px] border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
          <button 
            onClick={() => setActiveTab('pronti')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-[18px] text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'pronti' ? "bg-white dark:bg-zinc-800 text-sky-600 shadow-sm" : "text-zinc-400"
            )}
          >
            <Users size={16} />
            Allievi Pronti
          </button>
          <button 
            onClick={() => setActiveTab('sedute')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-[18px] text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'sedute' ? "bg-white dark:bg-zinc-800 text-sky-600 shadow-sm" : "text-zinc-400"
            )}
          >
            <CalendarIcon size={16} />
            Sedute d'Esame
          </button>
        </div>
      </div>
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 no-scrollbar">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'pronti' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {pronti.length === 0 ? (
                <div className="py-20 text-center text-zinc-400 font-bold uppercase tracking-widest text-xs">
                  Nessun allievo pronto per esame
                </div>
               ) : (
                  Object.values(pronti.reduce<Record<string, {istruttore: any, clienti: any[]}>>((acc, c) => {
                    const istrId = c.istruttore_pronto_id || 'unassigned';
                    if (!acc[istrId]) {
                      acc[istrId] = {
                        istruttore: c.istruttori || { id: 'unassigned', nome: 'Dichiarazioni', cognome: 'Generiche', colore: '#a1a1aa' },
                        clienti: []
                      };
                    }
                    acc[istrId].clienti.push(c);
                    return acc;
                  }, {})).map((group) => {
                    // By default expand, but allow toggling
                    const isGroupExpanded = !expandedInstructors.has(group.istruttore.id);
                    
                    return (
                      <div key={group.istruttore.id} className="bg-white/50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-[32px] p-2 shadow-sm">
                        {/* Intestazione Istruttore */}
                        <div 
                          onClick={() => toggleInstructor(group.istruttore.id)}
                          className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-[24px] cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/80 shadow-sm transition-all select-none"
                        >
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${group.istruttore.colore}20`, color: group.istruttore.colore }}>
                               <UserCircle size={24} />
                             </div>
                             <div>
                               <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                                 {group.istruttore.cognome} {group.istruttore.nome}
                               </h3>
                               <p className="text-[10px] font-bold text-zinc-400 uppercase">{group.clienti.length} Allievi Pronti</p>
                             </div>
                          </div>
                          <ChevronDown className={cn("text-zinc-400 transition-transform duration-300", isGroupExpanded && "rotate-180")} size={20} />
                        </div>
                        
                        {/* Griglia Clienti */}
                        {isGroupExpanded && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 px-2 pb-2">
                            {group.clienti.map((c) => {
                              const isExpanded = expandedIds.has(c.id);
                              return (
                                <div 
                                  key={c.id} 
                                  className={cn(
                                    "group relative bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden",
                                    isExpanded ? "rounded-[32px] p-5" : "rounded-2xl p-4"
                                  )}
                                >
                                  {/* Header Card - Sempre visibile */}
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                                        <GraduationCap size={24} />
                                      </div>
                                      <div>
                                        <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase leading-tight truncate max-w-[140px]">
                                          {c.cognome} {c.nome}
                                        </h3>
                                        {!isExpanded && (
                                           <div className="flex items-center gap-2 mt-0.5">
                                              <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-md text-[8px] font-black uppercase">
                                                {c.patenti?.tipo || 'N/D'}
                                              </span>
                                              {c.sessioni_esame && (
                                                <span className="text-[8px] font-black text-sky-500 uppercase tracking-widest flex items-center gap-1">
                                                   <CalendarIcon size={8} /> {format(new Date(c.sessioni_esame.data), 'dd/MM')}
                                                </span>
                                              )}
                                           </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => toggleExpand(c.id)}
                                        className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 flex items-center justify-center hover:bg-zinc-100 transition-all shadow-sm"
                                      >
                                        <ChevronDown className={cn("transition-transform duration-300", isExpanded && "rotate-180")} size={20} />
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Sezione Dettagli - Visibile solo se espanso */}
                                  {isExpanded && (
                                    <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                      <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/30 p-3 rounded-2xl">
                                        <div className="flex flex-col">
                                          <span className="text-[9px] font-black uppercase text-zinc-400">Patente richiesta</span>
                                          <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase">{c.patenti?.tipo || 'N/D'}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">
                                          <CheckCircle2 size={12} strokeWidth={3} />
                                          <span className="text-[9px] font-black uppercase tracking-widest">Pronto</span>
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-1 text-zinc-400">
                                          <Clock size={12} />
                                          <span className="text-[9px] font-bold uppercase tracking-widest">
                                            Dal: {c.data_pronto_esame ? format(new Date(c.data_pronto_esame), 'dd MMMM yyyy', { locale: it }) : 'N/D'}
                                          </span>
                                        </div>
              
                                        {c.sessioni_esame ? (
                                          <div className="flex items-center justify-between bg-sky-50 dark:bg-sky-500/5 border border-sky-100 dark:border-sky-800/20 p-3 rounded-2xl animate-in zoom-in-95 duration-200">
                                            <div>
                                              <p className="text-[8px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest">Seduta Assegnata</p>
                                              <p className="text-xs font-black text-zinc-900 dark:text-white uppercase truncate max-w-[120px]">{c.sessioni_esame.nome || 'Esame'}</p>
                                              <p className="text-[10px] font-bold text-sky-600/60">{format(new Date(c.sessioni_esame.data), 'dd MMMM', { locale: it })}</p>
                                            </div>
                                            <ConfirmBubble
                                              title="Rimuovi dalla seduta"
                                              message="Vuoi rimuovere questo allievo dalla sessione d'esame?"
                                              confirmLabel="Rimuovi"
                                              onConfirm={() => handleRemovePronto(c.id, true)}
                                              trigger={
                                                <button className="p-2 text-sky-300 hover:text-red-500 transition-colors">
                                                  <XCircle size={18} />
                                                </button>
                                              }
                                            />
                                          </div>
                                        ) : (
                                          <button 
                                            onClick={() => {
                                              setSelectedStudent(c);
                                              setIsAssignModalOpen(true);
                                            }}
                                            className="w-full py-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-zinc-400 hover:text-sky-500 hover:border-sky-500/50 hover:bg-sky-50/50 transition-all group"
                                          >
                                            <CalendarIcon size={14} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Assegna Seduta</span>
                                          </button>
                                        )}
                                      </div>
              
                                      <div className="flex gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                        <button 
                                          onClick={() => handleRemovePronto(c.id)}
                                          className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                                        >
                                          NON PRONTO
                                        </button>
                                        {isAdmin && (
                                          <ConfirmBubble
                                            title="Rimuovi allievo"
                                            message="Vuoi togliere definitivamente questo allievo dalla lista pronti?"
                                            onConfirm={() => handleRemovePronto(c.id)}
                                            trigger={
                                              <button className="p-3 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-2xl transition-all">
                                                <Trash2 size={16} />
                                              </button>
                                            }
                                          />
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
               )}
               
               {/* Tasto generale Scegli da Clienti */}
               <button 
                 onClick={() => setIsAddProntoModalOpen(true)}
                 className="w-full mt-4 py-5 border-[3px] border-dashed border-sky-100 dark:border-sky-900/50 rounded-[32px] text-sky-600 dark:text-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-900/10 hover:border-sky-500/50 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-2 group"
               >
                 <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white transition-all duration-300">
                    <Plus size={24} strokeWidth={3} />
                 </div>
                 <span className="text-xs font-black uppercase tracking-widest">Scegli da Clienti</span>
               </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {sedute.length === 0 ? (
                <div className="py-20 text-center text-zinc-400 font-bold uppercase tracking-widest text-xs">
                  Nessuna seduta programmata
                </div>
              ) : sedute.map((s) => (
                <div 
                  key={s.id} 
                  onClick={() => openDetailModal(s)}
                  className="bg-white dark:bg-zinc-900 p-6 rounded-[28px] border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm flex items-center justify-between group cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center justify-center w-16 h-16 rounded-[22px] bg-zinc-900 text-white shadow-xl shadow-zinc-900/20">
                      <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">
                        {format(new Date(s.data), 'MMM', { locale: it })}
                      </span>
                      <span className="text-2xl font-black leading-none">
                        {format(new Date(s.data), 'dd')}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                          {s.nome || 'Seduta d\'Esame'}
                        </h4>
                        <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-full text-[10px] font-black uppercase">
                          {s.clienti?.[0]?.count || 0} / {s.n_candidati} Candidati
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 font-bold">{s.note || 'Nessuna nota aggiuntiva'}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({
                            nome: s.nome || '',
                            data: s.data || '',
                            n_candidati: s.n_candidati || 0,
                            note: s.note || '',
                            ora_inizio: '08:30', // Default unless we store it later
                            istruttori_ids: []
                          });
                          setSelectedSeduta(s);
                          setIsModalOpen(true);
                        }}
                        className="p-4 text-sky-500 bg-sky-50 dark:bg-sky-900/30 rounded-2xl opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all hover:bg-sky-100 dark:hover:bg-sky-900/50"
                        title="Modifica seduta"
                      >
                        <Pencil size={20} />
                      </button>
                      <ConfirmBubble
                        title="Elimina seduta"
                        message="Sei sicuro di voler eliminare questa seduta d'esame?"
                        confirmLabel="Elimina"
                        onConfirm={() => handleDeleteSeduta(s.id)}
                        trigger={
                          <button 
                            className="p-4 text-red-500 bg-red-50 dark:bg-red-950/30 rounded-2xl opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100 dark:hover:bg-red-900/50"
                            title="Elimina seduta"
                          >
                            <Trash2 size={20} />
                          </button>
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Seduta */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuova Seduta Esame">
        <form onSubmit={handleCreateSeduta} className="space-y-6 pt-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nome Esame (es. Teoria, Guida B)</label>
            <input 
              required
              type="text" 
              placeholder="Inserisci nome esame..."
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full h-14 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 font-bold outline-none focus:border-zinc-900 dark:focus:border-sky-500 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Data Esame</label>
            <DatePicker 
              required
              selected={formData.data ? new Date(formData.data) : null}
              onChange={(date) => setFormData({ ...formData, data: date ? format(date, 'yyyy-MM-dd') : '' })}
              className="h-14 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Ora Inizio Blocco</label>
              <input 
                required
                type="time" 
                value={formData.ora_inizio}
                onChange={(e) => setFormData({ ...formData, ora_inizio: e.target.value })}
                className="w-full h-14 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 font-bold outline-none focus:border-zinc-900 dark:focus:border-sky-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Candidati Max</label>
              <input 
                required
                type="number" 
                value={formData.n_candidati === 0 ? '' : formData.n_candidati}
                onChange={(e) => setFormData({ ...formData, n_candidati: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                className="w-full h-14 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 font-bold outline-none focus:border-zinc-900 dark:focus:border-sky-500 transition-all"
              />
            </div>
          </div>

          {!selectedSeduta && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-2">
                <Users size={12} /> Istruttori Partecipanti (Blocco 3h)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto p-1 no-scrollbar">
                {istruttori.map(istr => (
                  <button
                    key={istr.id}
                    type="button"
                    onClick={() => {
                      const current = formData.istruttori_ids;
                      if (current.includes(istr.id)) {
                        setFormData({ ...formData, istruttori_ids: current.filter(id => id !== istr.id) });
                      } else {
                        setFormData({ ...formData, istruttori_ids: [...current, istr.id] });
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                      formData.istruttori_ids.includes(istr.id)
                        ? "bg-sky-50 border-sky-200 text-sky-700"
                        : "bg-white border-zinc-100 text-zinc-500"
                    )}
                  >
                    <div className="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: istr.colore }} />
                    <span className="text-[10px] font-bold uppercase truncate">{istr.cognome} {istr.nome}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Note (Opzionale)</label>
            <textarea 
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full h-32 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 font-bold outline-none focus:border-zinc-900 dark:focus:border-sky-500 transition-all resize-none"
              placeholder="Inserisci dettagli aggiuntivi..."
            />
          </div>
          <button 
            type="submit"
            className="w-full py-4 bg-zinc-900 dark:bg-sky-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-zinc-900/20 active:scale-95 transition-all"
          >
            Crea Seduta
          </button>
        </form>
      </Modal>

      {/* Modal Dettaglio/Gestione Seduta */}
      <Modal 
        isOpen={isDetailModalOpen} 
        onClose={() => setIsDetailModalOpen(false)} 
        title={selectedSeduta?.nome || 'Dettaglio Seduta'}
      >
        <div className="space-y-8 pt-4 pb-4">
          {/* Info Seduta */}
          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-[24px] border border-zinc-100 dark:border-zinc-800 relative group">
             <div className="flex justify-between items-center mb-4">
                <h4 className="text-[11px] font-black uppercase tracking-[0.1em] text-zinc-400">Info Seduta</h4>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                        setFormData({
                            nome: selectedSeduta.nome || '',
                            data: selectedSeduta.data || '',
                            n_candidati: selectedSeduta.n_candidati || 0,
                            note: selectedSeduta.note || '',
                            ora_inizio: '08:30', // In upgrade we don't have it saved yet
                            istruttori_ids: []
                        });
                        setIsDetailModalOpen(false);
                        setIsModalOpen(true);
                    }}
                    className="p-2 bg-white dark:bg-zinc-800 text-zinc-400 hover:text-blue-500 rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100"
                    title="Modifica seduta"
                  >
                    <Pencil size={14} />
                  </button>
                  <div className="px-3 py-1 bg-sky-500 text-white rounded-full text-[10px] font-black uppercase">
                     {sessionCandidates.length} / {selectedSeduta?.n_candidati} Candidati
                  </div>
                </div>
             </div>
             <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedSeduta?.note || 'Nessuna nota'}</p>
             <p className="text-xs text-zinc-400 mt-2 font-semibold">
               Data: {selectedSeduta?.data && format(new Date(selectedSeduta.data), 'dd MMMM yyyy', { locale: it })}
             </p>
          </div>

          {/* Lista Candidati */}
          <div>
            <div className="flex justify-between items-center mb-4 ml-1">
              <h4 className="text-[11px] font-black uppercase tracking-[0.1em] text-zinc-400 flex items-center gap-2">
                <Users size={12} /> Candidati Assegnati
              </h4>
            </div>
            
            <div className="space-y-3">
              {sessionCandidates.length === 0 ? (
                <div className="py-8 text-center bg-white dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Nessun candidato assegnato
                </div>
              ) : sessionCandidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-500 flex items-center justify-center">
                      <GraduationCap size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase">{c.cognome} {c.nome}</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase">Patente {c.patenti?.tipo}</p>
                    </div>
                  </div>
                  <ConfirmBubble
                    title="Rimuovi candidato"
                    message="Sei sicuro di voler rimuovere questo allievo dalla seduta?"
                    confirmLabel="Rimuovi"
                    onConfirm={() => handleRemovePronto(c.id, true).then(() => {
                        // Refresh local candidates
                        const filtered = sessionCandidates.filter(sc => sc.id !== c.id);
                        setSessionCandidates(filtered);
                    })}
                    trigger={
                      <button className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all">
                        <Trash2 size={16} />
                      </button>
                    }
                  />
                </div>
              ))}

              {/* Tasto + per Aggiungere Candidato */}
              {sessionCandidates.length < (selectedSeduta?.n_candidati || 0) && (
                <div className="relative">
                  <button 
                    onClick={() => setShowAddCandidate(!showAddCandidate)}
                    className="w-full py-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-zinc-400 hover:text-sky-500 hover:border-sky-500/50 hover:bg-sky-50/50 transition-all group"
                  >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Aggiungi Candidato</span>
                  </button>

                  {showAddCandidate && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 max-h-[250px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                       {pronti.filter(p => !p.sessione_esame_id).length === 0 ? (
                         <div className="p-4 text-center text-[10px] font-bold text-zinc-400 uppercase">Nessun allievo pronto disponibile</div>
                       ) : pronti.filter(p => !p.sessione_esame_id).map(p => (
                         <button
                           key={p.id}
                           onClick={() => {
                             handleAssignCandidate(p.id);
                             setShowAddCandidate(false);
                           }}
                           className="w-full text-left p-3 hover:bg-sky-50 dark:hover:bg-sky-500/10 rounded-xl transition-all flex items-center justify-between group"
                         >
                            <div>
                               <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase">{p.cognome} {p.nome}</p>
                               <p className="text-[9px] font-bold text-zinc-400 uppercase">Patente {p.patenti?.tipo}</p>
                            </div>
                            <Plus size={14} className="text-zinc-300 group-hover:text-sky-500" />
                         </button>
                       ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Selettore Seduta */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedStudent(null);
        }}
        title={`Assegna Seduta: ${selectedStudent?.cognome || ''}`}
      >
        <div className="space-y-4 pt-4 pb-4">
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Seleziona una seduta disponibile</p>
          <div className="grid gap-3">
            {/* Opzione per Rimuovere Seduta */}
            <button
              onClick={() => {
                if (selectedStudent) {
                  handleRemovePronto(selectedStudent.id, true);
                  setIsAssignModalOpen(false);
                  setSelectedStudent(null);
                  showToast('Assegnazione rimossa', 'success');
                }
              }}
              className="w-full text-left p-4 rounded-[20px] border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-red-500/50 hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-500 hover:text-red-500 transition-all flex items-center gap-4 group active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:bg-red-500 group-hover:text-white flex items-center justify-center transition-colors">
                <XCircle size={24} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black uppercase tracking-tight">Nessuna Seduta</p>
                <p className="text-[10px] font-bold uppercase mt-0.5 opacity-70">Rimuovi l'allievo da eventuali sedute</p>
              </div>
            </button>

            {sedute.length === 0 ? (
               <div className="py-20 text-center bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-400 uppercase">Nessuna seduta programmata</p>
               </div>
            ) : sedute.map(s => {
              const count = s.clienti?.[0]?.count || 0;
              const isFull = count >= s.n_candidati;
              return (
                <button
                  key={s.id}
                  disabled={isFull}
                  onClick={() => selectedStudent && handleAssignCandidate(selectedStudent.id, s.id)}
                  className={cn(
                    "w-full text-left p-5 rounded-[24px] border transition-all flex items-center justify-between group",
                    isFull 
                      ? "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 opacity-50 cursor-not-allowed" 
                      : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-sky-500/50 hover:shadow-lg active:scale-[0.98]"
                  )}
                >
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex flex-col items-center justify-center">
                        <span className="text-[8px] font-black uppercase leading-none opacity-60">{format(new Date(s.data), 'MMM', { locale: it })}</span>
                        <span className="text-lg font-black leading-none">{format(new Date(s.data), 'dd')}</span>
                     </div>
                     <div>
                        <p className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">{s.nome}</p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase mt-0.5">{s.note || 'Senza note'}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className={cn(
                       "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                       isFull ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                     )}>
                        {count} / {s.n_candidati}
                     </div>
                     {!isFull && <Plus size={18} className="text-zinc-300 group-hover:text-sky-500 transition-colors" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Modal Aggiungi Pronto d'Esame da Anagrafica */}
      <Modal
        isOpen={isAddProntoModalOpen}
        onClose={() => {
          setIsAddProntoModalOpen(false);
          setSearchQueryPronto('');
        }}
        title="Dichiara Allievo Pronto"
      >
        <div className="space-y-4 pt-4 pb-4">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text"
              placeholder="Cerca per nome o cognome..."
              value={searchQueryPronto}
              onChange={(e) => setSearchQueryPronto(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all text-sm font-semibold"
            />
          </div>
          
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Scegli un allievo dall'anagrafica clienti</p>
          
          <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-2 no-scrollbar">
            {notPronti
              .filter(c => {
                const q = searchQueryPronto.toLowerCase();
                return c.nome.toLowerCase().includes(q) || c.cognome.toLowerCase().includes(q);
              })
              .length === 0 ? (
               <div className="py-20 text-center bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-400 uppercase">{searchQueryPronto ? 'Nessun risultato trovato' : 'Nessun allievo disponibile'}</p>
               </div>
            ) : notPronti
                .filter(c => {
                  const q = searchQueryPronto.toLowerCase();
                  return c.nome.toLowerCase().includes(q) || c.cognome.toLowerCase().includes(q);
                })
                .map(c => (
              <button
                key={c.id}
                onClick={() => handleAddPronto(c.id)}
                className="w-full text-left p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-800 hover:border-sky-500/50 hover:bg-sky-50/10 bg-white dark:bg-zinc-900 shadow-sm transition-all flex items-center justify-between group active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:bg-sky-500 group-hover:text-white transition-colors flex items-center justify-center">
                     <UserCircle size={20} />
                   </div>
                   <div>
                      <p className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">{c.cognome} {c.nome}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mt-0.5">Patente {c.patenti?.tipo || 'N/D'}</p>
                   </div>
                </div>
                <div className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-800 flex items-center justify-center group-hover:border-sky-500 group-hover:bg-sky-500 group-hover:text-white text-zinc-300 transition-all">
                   <Plus size={16} strokeWidth={3} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
