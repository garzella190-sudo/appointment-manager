'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2, User, Calendar as CalendarIcon, StickyNote } from 'lucide-react';
import Select from '@/components/forms/Select';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { startOfWeek, addDays, format, isSameDay, parseISO, addMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import { createClient } from '@/utils/supabase/client';
import { Appointment } from '@/types';
import { DroppableCell } from '@/components/DroppableCell';
import { DraggableAppointment } from '@/components/DraggableAppointment';
import { cn } from '@/lib/utils';
import { Toast } from '@/components/Toast';
import NewAppointmentModal from '@/components/modals/NewAppointmentModal';
import DetailsModal from '@/components/modals/DetailsModal';
import { Clock } from 'lucide-react';
import { isItalianHoliday, isWeekend } from '@/utils/holidays';
import { updateAppointmentAction } from '@/actions/appointments';

const supabaseClient = createClient();

export interface AppointmentRow {
  id: string;
  data: string;
  durata: number;
  stato: string;
  note: string | null;
  importo: number | null;
  istruttore_id: string;
  veicolo_id: string | null;
  inizio: string | null;
  fine: string | null;
  data_solo: string | null;
  clienti: {
    id: string;
    nome: string;
    cognome: string;
    telefono: string | null;
    preferenza_cambio: string | null;
    patente_richiesta_id: string | null;
  } | null;
  istruttori: {
    nome: string;
    cognome: string;
    colore: string | null;
  } | null;
  veicoli: {
    id: string;
    targa: string;
    nome: string;
    colore: string | null;
  } | null;
}

export default function CalendarPage() {
  const supabase = supabaseClient;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [viewDays, setViewDays] = useState<1 | 3 | 5 | 7>(7);
  
  const [istruttori, setIstruttori] = useState<{ id: string; nome: string; cognome: string }[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('');
  const [showWeekends, setShowWeekends] = useState(true);
  const [granularity, setGranularity] = useState<15 | 30 | 60>(15);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Usa l'hook per gestire responsive in modo solido dopo l'idratazione
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    
    // Caricamento impostazioni da localStorage
    const savedInstructorId = localStorage.getItem('calendar_selectedInstructorId');
    const savedViewDays = localStorage.getItem('calendar_viewDays');
    const savedShowWeekends = localStorage.getItem('calendar_showWeekends');
    const savedDate = localStorage.getItem('calendar_currentDate');
    const savedGranularity = localStorage.getItem('calendar_granularity');

    if (savedInstructorId !== null) setSelectedInstructorId(savedInstructorId);
    if (savedViewDays !== null) setViewDays(parseInt(savedViewDays) as any);
    if (savedShowWeekends !== null) setShowWeekends(savedShowWeekends === 'true');
    if (savedGranularity !== null) setGranularity(parseInt(savedGranularity) as any);
    if (savedDate !== null) {
      try {
        setCurrentDate(new Date(savedDate));
      } catch (e) {
        console.error("Errore nel ripristino della data:", e);
      }
    }

    const handleResize = () => {
      // Solo se non abbiamo una preferenza salvata o se cambiamo breakpoint in modo significativo?
      // In realtà, la regola d'oro è "ricorda sempre la visualizzazione scelta".
      // Se l'utente non ha mai salvato nulla, usiamo il responsive.
      if (!savedViewDays) {
        if (window.innerWidth < 768) {
          setViewDays(3);
        } else {
          setViewDays(7);
        }
      }
    };
    handleResize(); // Chiamata iniziale
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Salvataggio impostazioni in localStorage
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('calendar_selectedInstructorId', selectedInstructorId);
    localStorage.setItem('calendar_viewDays', viewDays.toString());
    localStorage.setItem('calendar_showWeekends', showWeekends.toString());
    localStorage.setItem('calendar_currentDate', currentDate.toISOString());
    localStorage.setItem('calendar_granularity', granularity.toString());
  }, [selectedInstructorId, viewDays, showWeekends, currentDate, granularity, mounted]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate.getTime()]);
  // Per evitare scatti in fase di caricamento dal server
  const effectiveViewDays = mounted ? viewDays : 7; 
  // Forza sempre la partenza dal Lunedì come richiesto
  const displayStart = weekStart; 
  const displayDays = useMemo(() => {
    // Se la vista è a 7 giorni, mostriamo sempre l'intera settimana (Lun-Dom)
    if (viewDays === 7) {
      return Array.from({ length: 7 }, (_, i) => addDays(displayStart, i));
    }
    
    // Per 1, 3, 5 giorni, partiamo dalla data corrente e saltiamo i weekend se disattivati
    const days: Date[] = [];
    let d = new Date(currentDate);
    
    // Se oggi è un weekend e showWeekends è off, spostiamoci al lunedì successivo per iniziare la vista?
    // In realtà è meglio iniziare da oggi, ma se oggi è Sab/Dom e filtriamo, cerchiamo il primo giorno valido.
    if (!showWeekends && [0, 6].includes(d.getDay())) {
      // Se è domenica (0), aggiunge 1; se è sabato (6), aggiunge 2
      const offset = d.getDay() === 0 ? 1 : 2;
      d = addDays(d, offset);
    }

    while (days.length < viewDays) {
      if (showWeekends || ![0, 6].includes(d.getDay())) {
        days.push(new Date(d));
      }
      d = addDays(d, 1);
    }
    return days;
  }, [displayStart, viewDays, showWeekends, currentDate.getTime()]);

  // Generate intervals from 08:00 to 22:00 based on granularity
  const timeSlots = Array.from({ length: Math.floor((14 * 60) / granularity) + 1 }, (_, i) => {
    const totalMinutes = i * granularity;
    const h = Math.floor(totalMinutes / 60) + 8;
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  });

  const fetchWeekAppointments = useCallback(async () => {
    setLoading(true);
    const fetchStartDate = displayDays[0];
    const fetchEndDate = addDays(displayDays[displayDays.length - 1], 1);

    try {
      const [{ data: dbData, error: dbError }, { data: patentiData }, { data: istruttoriData }] = await Promise.all([
        supabase
          .from('appuntamenti')
          .select(`
            id, data, durata, stato, note, importo, istruttore_id, veicolo_id, inizio, fine, data_solo,
            clienti ( id, nome, cognome, telefono, preferenza_cambio, patente_richiesta_id ),
            istruttori ( nome, cognome, colore ),
            veicoli ( id, targa, nome, colore )
          `)
          .is('eliminato_il', null)
          .gte('data_solo', format(fetchStartDate, 'yyyy-MM-dd'))
          .lt('data_solo', format(fetchEndDate, 'yyyy-MM-dd')),
        supabase.from('patenti').select('id, tipo').is('eliminato_il', null),
        supabase.from('istruttori').select('id, nome, cognome').is('eliminato_il', null).order('cognome')
      ]);

      if (dbError) throw dbError;
      if (istruttoriData) setIstruttori(istruttoriData);
      
      const patentiMap = new Map<string, string>((patentiData || []).map((p: any) => [p.id, p.tipo]));

      const mappedAppointments = (dbData || []).map((row: any) => {
        const dateStr = row.data_solo || row.data.split('T')[0];
        const rowDate = new Date(row.data);
        const patenteId = row.clienti?.patente_richiesta_id;
        
        return {
          id: row.id,
          cliente_id: row.clienti?.id || '',
          appointment_date: dateStr,
          appointment_time: format(rowDate, 'HH:mm'),
          client_name: row.clienti ? `${row.clienti.cognome} ${row.clienti.nome}` : 'Sconosciuto',
          phone: row.clienti?.telefono || '',
          trainer_id: row.istruttore_id,
          vehicle_id: row.veicoli ? `${row.veicoli.nome} (${row.veicoli.targa})` : 'Nessuno',
          vehicle_id_uuid: row.veicolo_id,
          duration: row.durata,
          notes: row.note,
          status: row.stato,
          stato: row.stato,
          cost: row.importo || 0,
          license_type: patenteId ? (patentiMap.get(patenteId) || 'B') : 'B',
          gearbox_type: row.clienti?.preferenza_cambio === 'automatico' ? 'Automatico' : 'Manuale',
          istruttore: {
            name: row.istruttori ? `${row.istruttori.cognome} ${row.istruttori.nome}` : 'Non ass.',
            color: row.istruttori?.colore || '#3b82f6'
          },
          vehicle_color: row.veicoli?.colore
        };
      });

      setAppointments(mappedAppointments);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, displayDays]);

  useEffect(() => {
    if (mounted) fetchWeekAppointments();
  }, [currentDate, effectiveViewDays, mounted, fetchWeekAppointments]);

  // Auto-scroll to current time on load
  useEffect(() => {
    if (!loading && mounted && scrollContainerRef.current) {
      // Small timeout to ensure DOM is ready after loading state change
      const timer = setTimeout(() => {
        const now = new Date();
        const currentH = now.getHours();
        const currentM = now.getMinutes();
        
        // Clamp time within 08:00 - 22:00
        let targetH = currentH;
        let targetM = Math.floor(currentM / granularity) * granularity;
        
        if (targetH < 8) {
          targetH = 8;
          targetM = 0;
        } else if (targetH >= 22) {
          targetH = 22;
          targetM = 0;
        }
        
        const targetSlot = `${targetH.toString().padStart(2, '0')}:${targetM.toString().padStart(2, '0')}`;
        
        const element = document.getElementById(`slot-${targetSlot}`);
        if (element && scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const scrollPos = element.offsetTop - (container.clientHeight / 2) + (element.clientHeight / 2);
          container.scrollTo({ top: scrollPos, behavior: 'smooth' });
        }
      }, 500); // 500ms to be safe with animations
      return () => clearTimeout(timer);
    }
  }, [loading, mounted]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId((event.over?.id as string) || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (over && active.id !== over.id) {
      const [dateStr, timeStr] = (over.id as string).split('|');
      const formattedDate = format(parseISO(dateStr), 'dd/MM/yyyy');

      setToast({
        message: `Spostato al ${formattedDate} alle ore ${timeStr}`,
        type: 'success'
      });

      setAppointments(prev => prev.map(apt => {
        if (apt.id === active.id) {
          return { ...apt, appointment_date: dateStr, appointment_time: timeStr };
        }
        return apt;
      }));

      const targetApt = appointments.find(a => a.id === active.id);
      if (!targetApt) return;

      const duration = targetApt.duration || 30;
      const startDateTime = new Date(`${dateStr}T${timeStr}`);
      startDateTime.setSeconds(0, 0);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
      endDateTime.setSeconds(0, 0);
      
      const startISO = startDateTime.toISOString();
      const endISO = endDateTime.toISOString();

      // Call server action for robust validation and revalidation
      const result = await updateAppointmentAction(active.id as string, { 
        ...targetApt,
        data: startISO,
        inizio: startISO,
        fine: endISO,
        data_solo: dateStr,
        cliente_id: targetApt.cliente_id
      });

      if (result && !result.success) {
        setToast({
          message: result.error || 'Errore durante lo spostamento',
          type: 'error'
        });
        if (mounted) fetchWeekAppointments(); 
      }
    }
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * (effectiveViewDays === 7 ? 7 : effectiveViewDays)));
    setCurrentDate(newDate);
  };

  const activeAppointment = appointments.find(a => a.id === activeId);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newModalInitialData, setNewModalInitialData] = useState<{ date: string; time: string } | null>(null);

  const handleCellClick = (dateStr: string, slot: string) => {
    setNewModalInitialData({ date: dateStr, time: slot });
    setIsNewModalOpen(true);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        modifiers={[snapCenterToCursor]}
      >
        <div className="flex flex-col h-full w-full overflow-hidden">
          <header className="px-2 sm:px-4 md:px-6 py-2 pb-2 flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-shrink-0">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-display">Calendario</h1>
              <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 capitalize text-xs font-medium">
                {format(weekStart, 'MMMM yyyy', { locale: it })}
              </p>
            </div>

            <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
              {/* ... (pulsanti vista) */}
              <div className="flex flex-1 sm:flex-none justify-between sm:justify-start items-center gap-1 sm:gap-2 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl shadow-inner overflow-x-auto scrollbar-hide">
                {[1, 3, 5, 7].map((days) => (
                  <button
                    key={days}
                    onClick={() => setViewDays(days as 1 | 3 | 5 | 7)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
                      viewDays === days 
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    )}
                  >
                    {days} G
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl w-fit shadow-inner">
                <button
                  onClick={() => navigateWeek(-1)}
                  title="Settimana precedente"
                  className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-600 dark:text-zinc-400"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  title="Vai a oggi"
                  className="px-4 py-2 text-sm font-bold text-zinc-900 dark:text-zinc-100"
                >
                  Oggi
                </button>
                <button
                  onClick={() => navigateWeek(1)}
                  title="Settimana successiva"
                  className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-600 dark:text-zinc-400"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Granularity filter removed as per user request */}


              {viewDays !== 7 && (
                <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-2xl">
                  <button
                    onClick={() => setShowWeekends(!showWeekends)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                      showWeekends 
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-500" 
                        : "bg-white dark:bg-zinc-700 text-blue-600 shadow-sm"
                    )}
                  >
                    Sab-Dom: {showWeekends ? 'Sì' : 'No'}
                  </button>
                </div>
              )}

              <div className="min-w-[150px]">
                <Select
                  options={[
                    { id: '', label: 'Tutti gli istruttori' },
                    ...istruttori.map(i => ({ id: i.id, label: `${i.cognome} ${i.nome}` }))
                  ]}
                  value={selectedInstructorId}
                  onChange={(val) => setSelectedInstructorId(val)}
                  icon={User}
                  placeholder="Istruttore"
                  searchable
                />
              </div>
            </div>
          </header>

          <div className="flex-1 px-0.5 sm:px-1 md:px-2 pb-24 overflow-hidden flex flex-col">
            <div className="bg-white dark:bg-zinc-900/80 rounded-t-[24px] sm:rounded-t-[32px] md:rounded-t-[40px] shadow-2xl shadow-blue-500/5 border border-zinc-100 dark:border-zinc-800 overflow-hidden flex flex-col h-full rounded-b-[24px] sm:rounded-b-[32px] md:rounded-b-[40px]">
              {/* Intestazione Giorni Fissa */}
              <div 
                className="grid border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex-shrink-0"
                style={{ gridTemplateColumns: `60px repeat(${displayDays.length}, minmax(0, 1fr))` } as React.CSSProperties}
              >
                <div className="p-1 sm:p-4 border-r border-zinc-100 dark:border-zinc-800 flex items-center justify-center">
                  <Clock size={16} className="text-zinc-400" />
                </div>
                {displayDays.map((day: Date) => {
                  const isHoliday = isItalianHoliday(day) || isWeekend(day);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={day.toString()} className={cn(
                      "p-1 sm:p-2 text-center border-r border-zinc-100 dark:border-zinc-800 last:border-0",
                      isToday ? "bg-blue-50/50 dark:bg-blue-500/10" : ""
                    )}>
                      <span className={cn(
                        "block text-[10px] uppercase font-bold tracking-wider font-mono",
                        isHoliday ? "text-red-500" : "text-zinc-400"
                      )}>
                        {format(day, 'eee', { locale: it })}
                      </span>
                      <span className={cn(
                        "text-sm font-black mt-0 inline-flex w-7 h-7 items-center justify-center rounded-full transition-all",
                        isToday 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" 
                          : isHoliday
                            ? "text-red-600 dark:text-red-400"
                            : "text-zinc-900 dark:text-zinc-50"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Corpo Scorrevole */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto scroll-container scrollbar-hide relative pb-4"
              >
                {loading && (
                  <div className="absolute inset-0 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-[2px] z-50 flex items-center justify-center">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                  </div>
                )}

                {timeSlots.map((slot) => {
                  const isFullHour = slot.endsWith(':00');
                  return (
                    <div 
                      key={slot} 
                      id={`slot-${slot}`}
                      className={cn(
                        "grid border-b last:border-0 min-h-[40px] transition-colors",
                        isFullHour ? "border-zinc-200 dark:border-zinc-700" : "border-zinc-100/50 dark:border-zinc-800/30"
                      )}
                      style={{ 
                        gridTemplateColumns: `60px repeat(${displayDays.length}, minmax(0, 1fr))`,
                        zIndex: timeSlots.length - timeSlots.indexOf(slot),
                        position: 'relative'
                      } as React.CSSProperties}
                    >
                      <div className={cn(
                        "p-1 sm:p-2 text-xs sm:text-sm font-mono text-center sm:text-right border-r border-zinc-100 dark:border-zinc-800 flex items-center justify-center sm:justify-end pr-1 sm:pr-4",
                        isFullHour ? "font-black text-zinc-900 dark:text-zinc-300 bg-zinc-50/50 dark:bg-zinc-800/20" : "text-zinc-500 font-semibold"
                      )}>
                        {isFullHour ? slot : slot.split(':')[1]}
                      </div>
                      {displayDays.map((day: Date) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const cellId = `${dateStr}|${slot}`;
                        
                        const dayAppointments = appointments.filter(a => a.appointment_date === dateStr);
                        const slotStartTime = slot; // "HH:mm"
                        const slotEndTime = format(addMinutes(parseISO(`2000-01-01T${slot}`), granularity), "HH:mm");
                        
                        const cellAppointments = dayAppointments
                          .filter(apt => {
                            const aptTime = apt.appointment_time.slice(0, 5);
                            return (
                              aptTime >= slotStartTime && 
                              aptTime < slotEndTime &&
                              (!selectedInstructorId || apt.trainer_id === selectedInstructorId)
                            );
                          })
                          .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

                        return (
                          <DroppableCell key={cellId} id={cellId}>
                            <div 
                              className="w-full flex flex-col gap-0 relative cursor-pointer min-h-[40px]"
                              onClick={() => handleCellClick(dateStr, slot)}
                            >
                              {cellAppointments
                                .map((apt, idx) => {
                                const activeInCellCount = cellAppointments.filter(a => a.stato !== 'annullato').length;
                                const hasConflict = apt.stato !== 'annullato' && activeInCellCount > 1; 
                                
                                return (
                                  <div
                                    key={apt.id}
                                    className="relative w-full"
                                  >
                                    <DraggableAppointment
                                      appointment={apt}
                                      isOverlapping={hasConflict}
                                      onClick={setSelectedAppointment}
                                      isStacked={cellAppointments.length > 1}
                                      granularity={15}
                                      isFirst={idx === 0}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </DroppableCell>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          </div>
          <DragOverlay adjustScale={false} zIndex={100}>
            {activeId && activeAppointment ? (
              <div className="relative pointer-events-none">
                <div
                  className="w-48 p-4 rounded-2xl text-white shadow-2xl border border-white/20 ring-4 ring-black/5"
                  style={{
                    backgroundColor: activeAppointment.istruttore?.color || '#3b82f6',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black bg-black/20 px-1.5 py-0.5 rounded uppercase">
                      {activeAppointment.license_type}
                    </span>
                    <span className="text-[10px] font-bold opacity-80">
                      {activeAppointment.appointment_time.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-black leading-tight truncate">{activeAppointment.client_name}</p>
                    {activeAppointment.notes && activeAppointment.notes.trim() !== '' && (
                      <StickyNote size={14} className="text-white fill-white/20 shrink-0" />
                    )}
                  </div>
                </div>

                {overId && (
                  <div className="absolute -top-14 left-0 w-48 flex justify-center pointer-events-none">
                    <div className="bg-blue-600 text-white text-[11px] font-black py-2 px-4 rounded-2xl shadow-2xl whitespace-nowrap animate-bounce-subtle border border-white/20 flex items-center gap-2 ring-4 ring-blue-500/10">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      {format(parseISO(overId.split('|')[0]), 'dd MMMM', { locale: it })} • {overId.split('|')[1]}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </div>
      </div>
    </DndContext>

      <NewAppointmentModal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          setNewModalInitialData(null);
        }}
        onSuccess={() => {
          setIsNewModalOpen(false);
          setNewModalInitialData(null);
          fetchWeekAppointments();
        }}
        initialDate={newModalInitialData?.date}
        initialTime={newModalInitialData?.time}
      />

      {selectedAppointment && (
        <DetailsModal
          isOpen={true}
          onClose={() => setSelectedAppointment(null)}
          onSuccess={() => {
            setSelectedAppointment(null);
            fetchWeekAppointments();
          }}
          appointmentId={selectedAppointment.id}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
