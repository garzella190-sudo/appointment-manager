'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, ChevronRight, ChevronLeft, Clock, Loader2, User, Users, Calendar as CalendarIconSmall, Search, Car, Phone, StickyNote, Trash2, GraduationCap } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();
import { Appointment } from '@/types';
import { cn } from '@/lib/utils';
import { format, addDays, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { isItalianHoliday, isWeekend } from '@/utils/holidays';

import NewAppointmentModal from '@/components/modals/NewAppointmentModal';
import DetailsModal from '@/components/modals/DetailsModal';
import Select from '@/components/forms/Select';
import { ConfirmBubble } from '@/components/ConfirmBubble';
import { RefreshButton } from '@/components/RefreshButton';
import DatePickerModal from '@/components/modals/DatePickerModal';

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const lastScrollY = useRef(0);
  const hasAutoScrolled = useRef(false);
  
  const [istruttori, setIstruttori] = useState<{ id: string; nome: string; cognome: string }[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Popup state
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const dateStr = format(currentDate, 'yyyy-MM-dd');

    try {
      const [{ data: dbData, error: dbError }, { data: patentiData }, { data: istruttoriData }] = await Promise.all([
        supabase
          .from('appuntamenti')
          .select(`
            id, data, durata, stato, note, importo, istruttore_id, veicolo_id, inizio, fine,
            clienti ( id, nome, cognome, telefono, preferenza_cambio, patente_richiesta_id, sessione_esame_id, pronto_esame ),
            istruttori ( nome, cognome, colore ),
            veicoli ( id, targa, nome, colore )
          `)
          .eq('data_solo', dateStr)
          .order('data'),
        supabase.from('patenti').select('id, tipo'),
        supabase.from('istruttori').select('id, nome, cognome').order('cognome')
      ]);

      if (dbError) throw dbError;
      if (istruttoriData) setIstruttori(istruttoriData);

      const patentiMap = new Map<string, string>((patentiData || []).map((p: { id: string; tipo: string }) => [p.id, p.tipo]));

      const mappedAppointments: Appointment[] = (dbData || []).map((row: Record<string, any>) => {
        const rowDate = new Date(row.data);
        const clienteObj = Array.isArray(row.clienti) ? row.clienti[0] : row.clienti;
        const istruttoreObj = Array.isArray(row.istruttori) ? row.istruttori[0] : row.istruttori;
        const veicoloObj = Array.isArray(row.veicoli) ? row.veicoli[0] : row.veicoli;
        const patenteId = clienteObj?.patente_richiesta_id;
        const isUfficio = clienteObj?.nome === 'UFFICIO';
        return {
          id: row.id,
          cliente_id: clienteObj?.id || '',
          appointment_date: format(rowDate, 'yyyy-MM-dd'),
          appointment_time: format(rowDate, 'HH:mm'),
          client_name: isUfficio ? clienteObj.cognome : (clienteObj ? `${clienteObj.cognome} ${clienteObj.nome}` : 'Sconosciuto'),
          is_impegno: isUfficio,
          tipo_impegno: isUfficio ? (clienteObj?.cognome || '') : null,
          phone: clienteObj?.telefono || '',
          trainer_id: row.istruttore_id,
          vehicle_id: veicoloObj ? `${veicoloObj.nome} (${veicoloObj.targa})` : 'Nessuno',
          vehicle_color: veicoloObj?.colore,
          duration: row.durata,
          notes: row.note,
          status: row.stato,
          stato: row.stato,
          cost: row.importo || 0,
          license_type: patenteId ? (patentiMap.get(patenteId) || 'B') : 'B',
          gearbox_type: clienteObj?.preferenza_cambio === 'automatico' ? 'Automatico' : 'Manuale',
          istruttore: {
            name: istruttoreObj ? `${istruttoreObj.cognome} ${istruttoreObj.nome}` : 'Non ass.',
            color: istruttoreObj?.colore || '#3b82f6'
          },
          exam_status: clienteObj?.sessione_esame_id ? 'scheduled' : (clienteObj?.pronto_esame ? 'ready' : 'none')
        };
      });

      setAppointments(mappedAppointments as unknown as Appointment[]);
      
      if (selectedAppointment) {
        const updated = mappedAppointments.find(a => a.id === selectedAppointment.id);
        if (updated) setSelectedAppointment(updated as unknown as Appointment);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    console.log("Agenda V7 - Initialized");
    if (typeof window !== 'undefined' && !window.location.search.includes('no-alert')) {
      const alerted = localStorage.getItem('v7_alert_shown');
      if (!alerted) {
        alert("Agenda V7 Caricata - Se vedi questo, il codice è quello nuovo.");
        localStorage.setItem('v7_alert_shown', 'true');
      }
    }
    fetchAppointments();

    const handleUpdate = () => {
      console.log("Sync global triggered: fetching appointments...");
      fetchAppointments();
    };

    const handleResetToday = () => {
      setCurrentDate(new Date());
    };

    window.addEventListener('appointments-updated', handleUpdate);
    window.addEventListener('home-reset-today', handleResetToday);
    return () => {
      window.removeEventListener('appointments-updated', handleUpdate);
      window.removeEventListener('home-reset-today', handleResetToday);
    };
  }, [fetchAppointments]);

  // Reset auto-scroll flag when date changes
  useEffect(() => {
    hasAutoScrolled.current = false;
  }, [currentDate]);

  // Auto-scroll instantly once to the target appointment without looping
  useEffect(() => {
    if (!loading && appointments.length > 0 && isSameDay(currentDate, new Date()) && scrollContainerRef.current && !hasAutoScrolled.current) {
      // Small timeout to allow DOM to render completely
      const timer = setTimeout(() => {
        if (hasAutoScrolled.current) return;
        
        const now = new Date();
        const currentTime = format(now, 'HH:mm');
        
        const sorted = [...appointments].sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
        const targetApt = sorted.find(a => a.appointment_time >= currentTime) || sorted[sorted.length - 1];
        
        if (targetApt) {
          const aptElement = document.getElementById(`apt-${targetApt.id}`);
          const container = scrollContainerRef.current;
          const timeLineElement = document.getElementById('current-time-line');

          const elementToScroll = timeLineElement || aptElement;
          
          if (elementToScroll && container) {
            hasAutoScrolled.current = true;
            container.scrollTo({ 
              top: elementToScroll.offsetTop - (container.clientHeight / 2) + (elementToScroll.clientHeight / 2), 
              behavior: 'smooth' 
            });
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, appointments, currentDate]);

  // Search and Filter logic
  const filteredAppointments = useMemo(() => {
    let result = appointments;

    if (selectedInstructorId) {
      result = result.filter(a => a.trainer_id === selectedInstructorId);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => 
        (a.client_name?.toLowerCase().includes(q)) || 
        (a.istruttore?.name?.toLowerCase().includes(q)) ||
        (a.phone && a.phone.includes(q))
      );
    }
    
    return result;
  }, [appointments, searchQuery, selectedInstructorId]);

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchAppointments();
  };

  const navigateDay = (direction: number) => {
    setCurrentDate(prev => addDays(prev, direction));
  };


  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentY = e.currentTarget.scrollTop;
    if (currentY > lastScrollY.current && currentY > 50) {
      if (showSearch) setShowSearch(false);
      if (showFilter) setShowFilter(false);
    }
    lastScrollY.current = currentY;
  };

  const titleText = isSameDay(currentDate, new Date()) ? "Oggi" : format(currentDate, 'EEEE d MMMM', { locale: it });

  return (
    <div className="flex flex-col h-full animate-fade-in overflow-hidden">
      <div className="pt-2 px-4 md:px-6 pb-1 max-w-2xl mx-auto w-full flex-shrink-0">
        <header className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-none">Agenda</h1>
              <span className="text-[10px] font-black bg-sky-100 dark:bg-sky-900 text-sky-600 px-1.5 py-0.5 rounded-md tracking-tighter">V7</span>
              <RefreshButton onRefresh={fetchAppointments} className="h-8 w-8 p-0" />
            </div>
            <div className="flex items-center gap-3 mt-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-zinc-500 dark:text-zinc-400 capitalize text-sm font-semibold">
                  {format(currentDate, 'EEEE d MMMM yyyy', { locale: it })}
                </p>
                {appointments.some(a =>
                  a.is_impegno &&
                  (a as any).tipo_impegno?.toUpperCase().includes('ESAME')
                ) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-400 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm shadow-amber-400/30">
                    🎓 Esame
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50">
                <button
                  onClick={(e) => { e.preventDefault(); navigateDay(-1); }}
                  title="Giorno precedente"
                  className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); setCurrentDate(new Date()); }}
                  title="Vai a oggi"
                  className="px-3 py-1 text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider"
                >
                  Oggi
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); navigateDay(1); }}
                  title="Giorno successivo"
                  className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400"
                >
                  <ChevronRight size={18} />
                </button>
                
                <div className="w-[1px] h-5 bg-zinc-200 dark:bg-zinc-700/50 mx-0.5"></div>
                
                <button
                  onClick={() => setIsDatePickerOpen(true)}
                  className="h-8 w-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 hover:text-sky-600 dark:text-zinc-400 focus:outline-none cursor-pointer"
                  title="Scegli una data"
                >
                  <CalendarIconSmall size={18} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={() => { setShowSearch(!showSearch); setShowFilter(false); }}
              title="Cerca appuntamento"
              className={cn("p-2 h-9 rounded-xl transition-all shadow-sm flex items-center justify-center", showSearch ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-inner" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-sky-600")}
            >
              <Search size={16} />
            </button>
            <button
              onClick={() => { setShowFilter(!showFilter); setShowSearch(false); }}
              title="Filtra Istruttori"
              className={cn("p-2 h-9 rounded-xl transition-all shadow-sm flex items-center justify-center", showFilter || selectedInstructorId ? "bg-sky-100 dark:bg-sky-900 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-sky-600")}
            >
              <Users size={16} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-sky-500 px-3 md:px-4 h-9 ml-1 rounded-xl text-white font-black shadow-lg shadow-sky-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 text-[11px] uppercase tracking-wider"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nuovo</span>
            </button>
          </div>
        </header>

        <div className={cn(
          "transition-all duration-300 ease-in-out origin-top",
          (showSearch || showFilter) ? "max-h-[400px] opacity-100 mb-3 overflow-visible" : "max-h-0 opacity-0 mb-0 overflow-hidden"
        )}>
          {showSearch && (
            <div className="relative group w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-sky-500 transition-colors" size={20} />
              <input
                autoFocus
                type="text"
                placeholder="Cerca cliente, istruttore, o telefono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-12 pr-4 outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all text-sm shadow-sm appearance-none"
              />
            </div>
          )}
          {showFilter && (
            <div className="w-full">
              <Select
                options={[
                  { id: '', label: 'Tutti gli Istruttori' },
                  ...istruttori.map(i => ({ 
                    id: i.id, 
                    label: `${i.cognome} ${i.nome}`
                  }))
                ]}
                value={selectedInstructorId}
                onChange={(val) => {
                  setSelectedInstructorId(val);
                  setShowFilter(false); // Nascondi dopo aver scelto
                }}
                icon={Users}
                placeholder="Filtra Istruttore"
                searchable
              />
            </div>
          )}
        </div>
      </div>

      <section 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-container px-4 md:px-6 pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">{titleText}</h2>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{filteredAppointments.length} Guide</span>
          </div>

          {loading && appointments.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-zinc-400">
              <Loader2 className="animate-spin text-sky-500" size={40} />
              <p className="text-sm font-medium">Sincronizzazione...</p>
            </div>
          ) : filteredAppointments.length > 0 ? (
            <div className="grid gap-3">
              {filteredAppointments.map((apt, index) => {
                const initials = apt.client_name
                  .split(' ')
                  .filter(Boolean)
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                const now = new Date();
                const isToday = isSameDay(currentDate, now);
                const currentTimeStr = format(now, 'HH:mm');
                const nextApt = filteredAppointments[index + 1];
                
                let insertLineBefore = false;
                let insertLineAfter = false;
                
                if (isToday) {
                  if (index === 0 && apt.appointment_time > currentTimeStr) {
                    insertLineBefore = true;
                  } else if (apt.appointment_time <= currentTimeStr && (!nextApt || nextApt.appointment_time > currentTimeStr)) {
                    insertLineAfter = true;
                  }
                }

                const CurrentTimeLine = ({ time }: { time: string }) => (
                  <div className="flex items-center gap-2 my-1 -mx-2 px-2 relative" id={insertLineAfter || insertLineBefore ? "current-time-line" : undefined}>
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] border-2 border-white dark:border-zinc-900 z-10 shrink-0"></div>
                    <div className="flex-1 h-[2px] bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] rounded-full"></div>
                    <div className="text-[10px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm shrink-0">
                      {time}
                    </div>
                  </div>
                );

                return (
                  <React.Fragment key={apt.id}>
                    {insertLineBefore && <CurrentTimeLine time={currentTimeStr} />}
                    <div 
                      id={`apt-${apt.id}`}
                      onClick={() => {
                        setSelectedAppointment(apt);
                      }}
                      className={cn(
                        "relative border shadow-sm rounded-2xl p-4 flex items-center justify-between gap-4 group cursor-pointer hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/5 transition-all text-left pr-14",
                        apt.stato === 'annullato' ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60 grayscale" : "bg-white dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800"
                      )}
                    >
                      <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 shadow-inner"
                          style={{ 
                            backgroundColor: apt.stato === 'annullato' ? '#f4f4f5' : `${apt.istruttore?.color}20` || '#f1f5f9',
                            color: apt.stato === 'annullato' ? '#a1a1aa' : apt.istruttore?.color || '#0ea5e9'
                          }}
                        >
                          {initials}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className={cn(
                            "font-bold truncate flex items-center gap-2",
                            apt.stato === 'annullato' ? "text-zinc-500 dark:text-zinc-400 line-through" : "text-zinc-900 dark:text-white"
                          )}>
                            <span className={cn(
                              "tabular-nums text-xs font-black",
                              apt.stato === 'annullato' ? "text-zinc-400" : "text-sky-600 dark:text-sky-400"
                            )}>{apt.appointment_time}</span>
                            {apt.client_name}
                            {apt.exam_status && apt.exam_status !== 'none' && (
                              <GraduationCap 
                                size={14} 
                                className={cn(
                                  "shrink-0",
                                  apt.exam_status === 'scheduled' ? "text-emerald-500 fill-emerald-500/10" : "text-zinc-300"
                                )} 
                              />
                            )}
                          </h4>
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 mt-1.5">
                            {apt.phone && (
                              <a
                                href={`tel:${apt.phone.replace(/\D/g, '')}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-tighter hover:underline"
                              >
                                <Phone size={10} />
                                {apt.phone}
                              </a>
                            )}
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-tight bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md">
                              <User size={10} className="text-zinc-400" />
                              <span className="truncate">{apt.istruttore?.name}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-md text-[10px] font-black uppercase tracking-wider">
                              {apt.duration} min
                            </span>
                            {apt.license_type && (
                              <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:purple-400 rounded-md text-[10px] font-black uppercase tracking-wider">
                                Pat. {apt.license_type}
                              </span>
                            )}
                          </div>
                          {apt.notes && apt.notes.trim() !== '' && (
                            <div className="flex items-center gap-1 mt-2 text-zinc-400 italic">
                              <StickyNote size={10} className="shrink-0" />
                              <p className="text-[10px] truncate leading-none">{apt.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="absolute top-3 right-3 z-10">
                        <ConfirmBubble
                          title="Elimina Guida"
                          message="Sei sicuro di voler eliminare questo appuntamento?"
                          confirmLabel="Elimina"
                          onConfirm={async () => {
                            const { deleteAppointmentAction } = await import('@/actions/appointment_actions');
                            await deleteAppointmentAction(apt.id);
                            fetchAppointments();
                          }}
                          trigger={
                            <button className="p-1.5 rounded-lg text-zinc-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all border border-transparent shadow-sm bg-white dark:bg-zinc-900/80 hover:border-red-200 dark:hover:border-red-900/50">
                              <Trash2 size={16} />
                            </button>
                          }
                        />
                      </div>
                    </div>
                    {insertLineAfter && <CurrentTimeLine time={currentTimeStr} />}
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center bg-zinc-50 dark:bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                <CalendarIconSmall size={24} />
              </div>
              <div>
                <p className="text-zinc-900 dark:text-zinc-100 font-bold">Nessun risultato trovato</p>
                <p className="text-zinc-500 text-sm">Prova a cambiare i filtri o la data.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <NewAppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />

      {selectedAppointment && (
        <DetailsModal
          isOpen={true}
          onClose={() => setSelectedAppointment(null)}
          onSuccess={fetchAppointments}
          appointmentId={selectedAppointment.id}
        />
      )}

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedDate={currentDate}
        onSelect={(date) => setCurrentDate(date)}
      />
    </div>
  );
}
