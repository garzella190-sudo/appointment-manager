'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { useRouter } from 'next/navigation';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Users, 
  Clock, 
  Loader2, 
  Search,
  Filter,
  MoreVertical,
  Check,
  User,
  ChevronDown,
  StickyNote
} from 'lucide-react';
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
import { startOfWeek, addDays, format, isSameDay, parseISO, addMinutes, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { createClient } from '@/utils/supabase/client';
import { Appointment } from '@/types';
import { DroppableCell } from '@/components/DroppableCell';
import { DraggableAppointment } from '@/components/DraggableAppointment';
import { RefreshButton } from '@/components/RefreshButton';
import { cn } from '@/lib/utils';
import { Toast } from '@/components/Toast';
import NewAppointmentModal from '@/components/modals/NewAppointmentModal';
import DetailsModal from '@/components/modals/DetailsModal';
import ExamSessionModal from '@/components/modals/ExamSessionModal';

import DatePickerModal from '@/components/modals/DatePickerModal';
import { isItalianHoliday, isWeekend } from '@/utils/holidays';
import { ConflictsAlert } from '@/components/ConflictsAlert';

class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: { nativeEvent: PointerEvent }) => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          return false; // Disable dragging on mobile
        }
        if (!event.isPrimary || event.button !== 0) {
          return false;
        }
        return true;
      },
    },
  ];
}

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

let datePickerCloseTime = 0;

import { useAuth } from '@/hooks/useAuth';

export default function CalendarPage() {
  const { role, isSegreteria, isAdmin } = useAuth();
  const supabase = supabaseClient;
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [viewDays, setViewDays] = useState<1 | 3 | 5 | 7>(7);
  
  const [istruttori, setIstruttori] = useState<{ id: string; nome: string; cognome: string }[]>([]);
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [showWeekends, setShowWeekends] = useState(true);
  const [granularity, setGranularity] = useState<15 | 30 | 60>(15);
  const [viewMode, setViewMode] = useState<'week' | 'resource'>('week');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Usa l'hook per gestire responsive in modo solido dopo l'idratazione
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!mounted) return;
    
    // Default view mode for staff if no saved preference
    const savedViewMode = localStorage.getItem('calendar_viewMode');
    if (savedViewMode === null && (role === 'segreteria' || isAdmin)) {
      setViewMode('resource');
    }
  }, [mounted, role, isAdmin]);

  useEffect(() => {
    setMounted(true);
    setIsMobile(window.innerWidth < 768);
    
    // Caricamento impostazioni da localStorage
    const savedInstructorIds = localStorage.getItem('calendar_selectedInstructorIds');
    const savedViewDays = localStorage.getItem('calendar_viewDays');
    const savedShowWeekends = localStorage.getItem('calendar_showWeekends');
    const savedDate = localStorage.getItem('calendar_currentDate');
    const savedGranularity = localStorage.getItem('calendar_granularity');
    const savedViewMode = localStorage.getItem('calendar_viewMode');

    if (savedInstructorIds) try { setSelectedInstructorIds(JSON.parse(savedInstructorIds)); } catch {}
    if (savedViewDays !== null) setViewDays(parseInt(savedViewDays) as any);
    if (savedShowWeekends !== null) setShowWeekends(savedShowWeekends === 'true');
    if (savedGranularity !== null) setGranularity(parseInt(savedGranularity) as any);
    if (savedViewMode !== null) setViewMode(savedViewMode as any);
    if (savedDate !== null) {
      try {
        setCurrentDate(new Date(savedDate));
      } catch (e) {
        console.error("Errore nel ripristino della data:", e);
      }
    }

    const handleResize = () => {
      const width = window.innerWidth;
      let newViewDays: 1 | 3 | 5 | 7 = 7;
      
      if (width < 640) { // Mobile
        newViewDays = savedViewDays === '1' ? 1 : 3;
      } else if (width < 1024) { // Tablet
        newViewDays = (savedViewDays === '1' || savedViewDays === '3') ? parseInt(savedViewDays) as 1 | 3 : 5;
      } else { // Desktop
        newViewDays = savedViewDays ? parseInt(savedViewDays) as 1 | 3 | 5 | 7 : 7;
      }
      
      setViewDays(newViewDays);
    };

    handleResize(); // Chiamata iniziale
    const handleMobileCheck = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleMobileCheck);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleMobileCheck);
    };
  }, []);

  // Salvataggio impostazioni in localStorage
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('calendar_selectedInstructorIds', JSON.stringify(selectedInstructorIds));
    localStorage.setItem('calendar_viewDays', viewDays.toString());
    localStorage.setItem('calendar_showWeekends', showWeekends.toString());
    localStorage.setItem('calendar_currentDate', currentDate.toISOString());
    localStorage.setItem('calendar_granularity', granularity.toString());
    localStorage.setItem('calendar_viewMode', viewMode);
  }, [selectedInstructorIds, viewDays, showWeekends, currentDate, granularity, viewMode, mounted]);

  const getDayClass = (date: Date) => {
    if (isItalianHoliday(date) || isWeekend(date)) return "is-holiday";
    return "";
  };

  // Disable drag & drop on mobile using SmartPointerSensor to avoid changing hooks array length
  const sensors = useSensors(
    useSensor(SmartPointerSensor, {
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
            clienti ( id, nome, cognome, telefono, preferenza_cambio, patente_richiesta_id, sessione_esame_id, pronto_esame ),
            istruttori ( nome, cognome, colore ),
            veicoli ( id, targa, nome, colore )
          `)
          .gte('data_solo', format(fetchStartDate, 'yyyy-MM-dd'))
          .lt('data_solo', format(fetchEndDate, 'yyyy-MM-dd')),
        supabase.from('patenti').select('id, tipo'),
        supabase.from('istruttori').select('id, nome, cognome').order('cognome')
      ]);

      if (dbError) throw dbError;
      if (istruttoriData) setIstruttori(istruttoriData);
      
      const patentiMap = new Map<string, string>((patentiData || []).map((p: any) => [p.id, p.tipo]));

      const mappedAppointments = (dbData || []).map((row: any) => {
        const dateStr = row.data_solo || row.data.split('T')[0];
        const rowDate = new Date(row.data);
        const patenteId = row.clienti?.patente_richiesta_id;
        
        const isUfficio = row.clienti?.nome === 'UFFICIO';
        const tipoImpegno = isUfficio ? (row.clienti?.cognome || '') : null;
        let finalClientName = row.clienti ? `${row.clienti.cognome} ${row.clienti.nome}` : 'Sconosciuto';
        if (isUfficio) {
          if (tipoImpegno?.toUpperCase().includes('ESAME')) {
            finalClientName = 'Esame di Guida';
          } else {
            finalClientName = tipoImpegno || 'Impegno';
          }
        }

        return {
          id: row.id,
          cliente_id: row.clienti?.id || '',
          appointment_date: dateStr,
          appointment_time: format(rowDate, 'HH:mm'),
          client_name: finalClientName,
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
          vehicle_color: row.veicoli?.colore,
          is_impegno: isUfficio,
          tipo_impegno: tipoImpegno,
          exam_status: row.clienti?.sessione_esame_id ? 'scheduled' : (row.clienti?.pronto_esame ? 'ready' : 'none')
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

    const handleUpdate = () => {
      console.log("Calendar sync global triggered...");
      fetchWeekAppointments();
    };

    const handleResetToday = () => {
      setCurrentDate(new Date());
    };

    window.addEventListener('appointments-updated', handleUpdate);
    window.addEventListener('calendar-reset-today', handleResetToday);
    return () => {
      window.removeEventListener('appointments-updated', handleUpdate);
      window.removeEventListener('calendar-reset-today', handleResetToday);
    };
  }, [currentDate, effectiveViewDays, mounted, fetchWeekAppointments]);

  // Auto-scroll logic: go to current time if apps exist near, otherwise start at 09:00
  useEffect(() => {
    if (!loading && mounted && scrollContainerRef.current) {
      // Small timeout to ensure DOM is ready
      const timer = setTimeout(() => {
        const now = new Date();
        const currentH = now.getHours();
        const currentM = now.getMinutes();
        const nowStr = format(now, 'yyyy-MM-dd');
        
        let targetH = currentH;
        let targetM = Math.floor(currentM / granularity) * granularity;
        
        if (targetH < 8) {
          targetH = 8;
          targetM = 0;
        } else if (targetH >= 22) {
          targetH = 22;
          targetM = 0;
        }
        
        // Controlla se ci sono appuntamenti nelle prossime 2-3 ore o in corso
        const hasApptNear = appointments.some(a => {
          if (!a.appointment_time || a.appointment_date !== nowStr) return false;
          const [aptH, aptM] = a.appointment_time.split(':').map(Number);
          const startD = new Date(now);
          startD.setHours(aptH, aptM, 0, 0);
          
          const endD = new Date(startD);
          endD.setMinutes(endD.getMinutes() + (a.duration || 60));
          
          const timeDiff = Math.abs((startD.getTime() - now.getTime()) / (1000 * 60 * 60));
          return (now >= startD && now <= endD) || timeDiff <= 2.5; 
        });

        const container = scrollContainerRef.current;
        if (!container) return;
        
        let scrollPos = 0;

        if (hasApptNear) {
          const targetSlot = `${targetH.toString().padStart(2, '0')}:${targetM.toString().padStart(2, '0')}`;
          const element = document.getElementById(`slot-${targetSlot}`);
          if (element) {
            scrollPos = element.offsetTop - (container.clientHeight / 2) + (element.clientHeight / 2);
          }
        } else {
          // Posizionati alle 9 come primo rigo visibile
          const element = document.getElementById(`slot-09:00`);
          if (element) {
            scrollPos = element.offsetTop - 10;
          }
        }

        if (scrollPos > 0) {
          container.scrollTo({ top: scrollPos, behavior: 'smooth' });
        }
      }, 500); // 500ms to be safe with animations
      return () => clearTimeout(timer);
    }
  }, [loading, mounted, appointments, granularity]);

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
      const parts = (over.id as string).split('|');
      const dateStr = parts[0];
      const timeStr = parts[1];
      const newInstructorId = parts[2] || null; // Optional instructor ID from cell
      
      const formattedDate = format(parseISO(dateStr), 'dd/MM/yyyy');

      setToast({
        message: `Spostato al ${formattedDate} alle ore ${timeStr}`,
        type: 'success'
      });

      setAppointments(prev => prev.map(apt => {
        if (apt.id === active.id) {
          return { 
            ...apt, 
            appointment_date: dateStr, 
            appointment_time: timeStr,
            trainer_id: newInstructorId || apt.trainer_id 
          };
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

      const updatePayload: any = {
        data: startISO,
        inizio: startISO,
        fine: endISO,
        data_solo: dateStr,
      };

      if (newInstructorId) {
        updatePayload.istruttore_id = newInstructorId;
      }

      const { error: dragError } = await supabase
        .from('appuntamenti')
        .update(updatePayload)
        .eq('id', active.id as string);

      if (dragError) {
        console.error('Drag & Drop save error:', dragError);
        setToast({
          message: 'Errore durante il salvataggio dello spostamento. Riprova.',
          type: 'error'
        });
        if (mounted) fetchWeekAppointments();
      }
    }
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    const step = viewMode === 'resource' ? 1 : (effectiveViewDays === 7 ? 7 : effectiveViewDays);
    newDate.setDate(newDate.getDate() + (direction * step));
    setCurrentDate(newDate);
  };

  const activeAppointment = appointments.find(a => a.id === activeId);

  // Filtered instructors for resource view
  const displayIstruttori = selectedInstructorIds.length > 0
    ? istruttori.filter(i => selectedInstructorIds.includes(i.id))
    : istruttori;

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newModalInitialData, setNewModalInitialData] = useState<{ date: string; time: string } | null>(null);

  const handleCellClick = (dateStr: string, slot: string) => {
    if (Date.now() - datePickerCloseTime < 500) return;
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-display">Calendario</h1>
              <RefreshButton onRefresh={fetchWeekAppointments} className="h-8 w-8 p-0" />
            </div>
              <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 capitalize text-xs font-medium">
                {viewMode === 'resource' 
                  ? format(currentDate, 'EEEE d MMMM yyyy', { locale: it })
                  : format(weekStart, 'MMMM yyyy', { locale: it })
                }
              </p>
            </div>

            {/* Row 1: View mode + day selector */}
            <div className="flex flex-row items-center gap-1.5 sm:gap-3 w-full lg:w-auto mt-2 lg:mt-0">
              {/* Vista Giorni: Dropdown su mobile */}
              <div className="relative shrink-0 sm:hidden flex items-center h-10 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-inner">
                <select
                  value={viewDays}
                  onChange={(e) => setViewDays(parseInt(e.target.value) as 1 | 3 | 5 | 7)}
                  className="appearance-none bg-transparent h-8 w-[48px] px-2 text-center text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider hover:text-blue-600 transition-all cursor-pointer outline-none border-none shadow-none"
                >
                  <option value={1}>1 G</option>
                  <option value={3}>3 G</option>
                  <option value={5}>5 G</option>
                  <option value={7}>7 G</option>
                </select>
              </div>
              
              <div className="flex shrink-0 items-center gap-1 sm:gap-2 h-10 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl shadow-inner border border-zinc-200/50 dark:border-zinc-800/50">
                <button
                  onClick={() => setViewMode('week')}
                  className={cn(
                    "px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-wider border",
                    viewMode === 'week' 
                      ? "bg-blue-600 text-white border-blue-500 shadow-md" 
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border-transparent"
                  )}
                >
                  Settimana
                </button>
                <div className="hidden sm:block w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
                <div className="hidden sm:flex items-center gap-1">
                  {[1, 3, 5, 7].map((days) => (
                    <button
                      key={days}
                      disabled={viewMode === 'resource'}
                      onClick={() => setViewDays(days as 1 | 3 | 5 | 7)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-wider border",
                        viewDays === days && viewMode === 'week'
                          ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800 shadow-sm" 
                          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border-transparent hover:border-zinc-200 dark:hover:border-zinc-800",
                        viewMode === 'resource' && "opacity-30 cursor-not-allowed"
                      )}
                    >
                      {days} G
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekend + Istruttori toggle + Nav */}
              <div className="flex items-center gap-1.5 ml-auto">
                {viewDays !== 7 && (
                  <button
                    onClick={() => setShowWeekends(!showWeekends)}
                    title={!showWeekends ? "Mostra Weekend" : "Nascondi Weekend"}
                    className={cn(
                      "h-10 px-2.5 sm:px-4 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap shadow-sm border",
                      !showWeekends
                        ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-red-500"
                    )}
                  >
                    WE
                  </button>
                )}

                <button
                  onClick={() => {
                    if (viewMode === 'resource') {
                      setViewMode('week');
                    } else {
                      setShowFilter(!showFilter);
                    }
                  }}
                  title={viewMode === 'resource' ? "Torna a Settimana" : "Filtra / Vista Istruttori"}
                  className={cn("h-10 w-10 shrink-0 flex items-center justify-center rounded-xl transition-all shadow-sm border", 
                    viewMode === 'resource'
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-md"
                      : showFilter || selectedInstructorIds.length > 0 
                        ? "bg-sky-100 dark:bg-sky-900 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400" 
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-sky-600")}
                >
                  <Users size={16} />
                </button>

                <div className="flex items-center shrink-0 h-10 gap-0.5 sm:gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-inner">
                  <button
                    onClick={() => navigateWeek(-1)}
                    title="Settimana precedente"
                    className="h-8 w-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    title="Vai a oggi"
                    className="px-1.5 sm:px-3 h-8 text-[10px] sm:text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider hover:text-blue-600 transition-all flex items-center"
                  >
                    {displayDays.some(d => isToday(d)) ? 'Oggi' : format(currentDate, 'd MMM', { locale: it })}
                  </button>
                  <button
                    onClick={() => navigateWeek(1)}
                    title="Settimana successiva"
                    className="h-8 w-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400"
                  >
                    <ChevronRight size={18} />
                  </button>
                  
                  <div className="hidden sm:block w-[1px] h-5 bg-zinc-200 dark:bg-zinc-700/50 mx-0.5"></div>
                  
                  <button
                    onClick={() => setIsDatePickerOpen(true)}
                    className="hidden sm:flex h-8 w-8 items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 hover:text-blue-600 dark:text-zinc-400 focus:outline-none cursor-pointer"
                    title="Scegli una data"
                  >
                    <CalendarIcon size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className={cn(
               "transition-all duration-300 ease-in-out origin-top",
               showFilter ? "max-h-[400px] opacity-100 mt-2 overflow-visible" : "max-h-0 opacity-0 mt-0 overflow-hidden"
            )}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => { setSelectedInstructorIds([]); setViewMode('week'); }}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border active:scale-95",
                      selectedInstructorIds.length === 0
                        ? "bg-sky-500 text-white border-sky-400 shadow-md"
                        : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                    )}
                  >
                    Tutti
                  </button>
                  {[...istruttori]
                    .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`))
                    .map(i => {
                      const isSelected = selectedInstructorIds.length === 0 || selectedInstructorIds.includes(i.id);
                      const initials = `${i.cognome?.[0] || ''}${i.nome?.[0] || ''}`.toUpperCase();
                      
                      return (
                        <button
                          key={i.id}
                          onClick={() => {
                              setSelectedInstructorIds(prev => {
                                let next: string[];
                                if (prev.length === 0) {
                                  next = [i.id];
                                } else if (prev.includes(i.id)) {
                                  next = prev.filter(id => id !== i.id);
                                  if (next.length === 0) next = [];
                                } else {
                                  next = [...prev, i.id];
                                }
                                
                                // Auto-switch view mode only if going from 1 to 2+
                                if (next.length >= 2 && viewMode === 'week') {
                                  setViewMode('resource');
                                }
                                return next;
                              });
                          }}
                          className={cn(
                            "px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border active:scale-95 flex items-center gap-1.5",
                            selectedInstructorIds.includes(i.id)
                              ? "bg-sky-500 text-white border-sky-400 shadow-md"
                              : selectedInstructorIds.length === 0
                                ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800"
                                : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400"
                          )}
                        >
                          <span className={cn(
                            "w-5 h-5 flex items-center justify-center rounded-lg text-[8px]",
                            selectedInstructorIds.includes(i.id) 
                              ? "bg-white/20 text-white" 
                              : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                          )}>
                            {initials}
                          </span>
                          {i.nome} {i.cognome}
                        </button>
                      );
                    })}
                </div>
                <button
                  onClick={() => { setViewMode('resource'); setShowFilter(false); }}
                  className="h-10 px-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md border border-indigo-500 active:scale-95 transition-all flex items-center gap-2 justify-center w-full sm:w-auto"
                >
                  <Users size={14} />
                  Vista Istruttori
                </button>
              </div>
            </div>
          </header>

          <ConflictsAlert />

          <div className="flex-1 px-0.5 sm:px-1 md:px-2 pb-2 md:pb-4 overflow-hidden flex flex-col">
            <div className="bg-white dark:bg-zinc-900/80 rounded-t-[24px] sm:rounded-t-[32px] md:rounded-t-[40px] shadow-2xl shadow-blue-500/5 border border-zinc-100 dark:border-zinc-800 overflow-hidden flex flex-col h-full rounded-b-[24px] sm:rounded-b-[32px] md:rounded-b-[40px] scrollbar-hide">
              <div className="w-full flex flex-col h-full">
              <div 
                className="grid border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex-shrink-0"
                style={{ gridTemplateColumns: `60px repeat(${viewMode === 'week' ? displayDays.length : Math.max(1, displayIstruttori.length)}, minmax(0, 1fr))` } as React.CSSProperties}
              >
                <div className="p-1 sm:p-4 border-r border-zinc-100 dark:border-zinc-800 flex items-center justify-center">
                  <Clock size={16} className="text-zinc-400" />
                </div>
                {viewMode === 'week' ? displayDays.map((day: Date) => {
                  const isHoliday = isItalianHoliday(day) || isWeekend(day);
                  const isToday = isSameDay(day, new Date());
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const hasEsame = appointments.some(a =>
                    a.appointment_date === dayStr &&
                    a.is_impegno &&
                    a.tipo_impegno?.toUpperCase().includes('ESAME')
                  );
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
                      {hasEsame && (
                        <div className="mt-0.5 mx-auto w-fit px-1.5 py-0.5 bg-amber-400 dark:bg-amber-500 text-white rounded text-[8px] font-black uppercase tracking-wider leading-none flex items-center gap-0.5 shadow-sm shadow-amber-400/30">
                          🎓 Esame
                        </div>
                      )}
                    </div>
                  );
                }) : displayIstruttori.map((ist: any) => {
                  const istColor = appointments.find(a => a.trainer_id === ist.id)?.istruttore?.color || '#3b82f6';
                  return (
                    <div key={ist.id} className="p-1 sm:p-2 text-center border-r border-zinc-100 dark:border-zinc-800 last:border-0 flex flex-col items-center justify-center">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-md mb-1" style={{ backgroundColor: istColor }}>
                        {ist.cognome?.[0] || '?'}{ist.nome?.[0] || ''}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100 truncate w-full px-1">
                        {ist.cognome}
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
                  const [slotH, slotM] = slot.split(':').map(Number);
                  
                  const nowLine = new Date();
                  const currentHLine = nowLine.getHours();
                  const currentMLine = nowLine.getMinutes();
                  const slotStartMinutes = slotH * 60 + slotM;
                  const currentTotalMinutes = currentHLine * 60 + currentMLine;
                  const isCurrentSlot = currentTotalMinutes >= slotStartMinutes && currentTotalMinutes < slotStartMinutes + granularity;
                  const hasToday = displayDays.some(d => isSameDay(d, nowLine));

                  return (
                      <div 
                        key={slot} 
                        id={`slot-${slot}`}
                        className={cn(
                          "grid min-h-[40px] transition-colors relative",
                          isFullHour ? "border-zinc-200 dark:border-zinc-700 border-b" : "border-zinc-100/50 dark:border-zinc-800/30 border-b"
                        )}
                        style={{ 
                          gridTemplateColumns: `60px repeat(${viewMode === 'week' ? displayDays.length : Math.max(1, displayIstruttori.length)}, minmax(0, 1fr))`,
                          zIndex: isCurrentSlot ? 40 : timeSlots.length - timeSlots.indexOf(slot),
                        } as React.CSSProperties}
                      >
                      {isCurrentSlot && hasToday && (
                        <div 
                          className="absolute left-0 right-0 z-50 flex items-center pointer-events-none"
                          style={{ top: `${((currentTotalMinutes - slotStartMinutes) / granularity) * 100}%`, transform: 'translateY(-50%)' }}
                        >
                          <div className="w-[60px] flex justify-end pr-1 sm:pr-3">
                            <span className="text-[10px] font-black text-red-500 bg-white dark:bg-zinc-900 px-1 rounded-sm shadow-sm">{format(nowLine, 'HH:mm')}</span>
                          </div>
                          <div className="flex-1 h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] flex relative">
                            <div className="absolute left-0 w-2 h-2 rounded-full bg-red-500 top-1/2 -translate-y-1/2"></div>
                          </div>
                        </div>
                      )}

                      <div className={cn(
                        "p-1 sm:p-2 text-xs sm:text-sm font-mono text-center sm:text-right border-r border-zinc-100 dark:border-zinc-800 flex items-center justify-center sm:justify-end pr-1 sm:pr-4",
                        isFullHour ? "font-black text-zinc-900 dark:text-zinc-300 bg-zinc-50/50 dark:bg-zinc-800/20" : "text-zinc-500 font-semibold"
                      )}>
                        {isFullHour ? slot : slot.split(':')[1]}
                      </div>
                      {viewMode === 'week' ? displayDays.map((day: Date) => {
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
                              (selectedInstructorIds.length === 0 || selectedInstructorIds.includes(apt.trainer_id))
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
                                const activeAppointments = cellAppointments.filter(a => a.stato !== 'annullato');
                                const hasConflict = apt.stato !== 'annullato' && activeAppointments.some(other => 
                                  other.id !== apt.id && 
                                  (other.trainer_id === apt.trainer_id || 
                                   other.vehicle_id_uuid === apt.vehicle_id_uuid || 
                                   other.cliente_id === apt.cliente_id)
                                );
                                
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
                      }) : displayIstruttori.map((ist: any) => {
                        const dateStr = format(currentDate, 'yyyy-MM-dd');
                        const cellId = `${dateStr}|${slot}|${ist.id}`;
                        
                        const dayAppointments = appointments.filter(a => a.appointment_date === dateStr);
                        const slotStartTime = slot;
                        const slotEndTime = format(addMinutes(parseISO(`2000-01-01T${slot}`), granularity), "HH:mm");
                        
                        const cellAppointments = dayAppointments
                          .filter(apt => {
                            const aptTime = apt.appointment_time.slice(0, 5);
                            return (
                              aptTime >= slotStartTime && 
                              aptTime < slotEndTime &&
                              apt.trainer_id === ist.id
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
                                const activeAppointments = cellAppointments.filter(a => a.stato !== 'annullato');
                                const hasConflict = apt.stato !== 'annullato' && activeAppointments.some(other => 
                                  other.id !== apt.id && 
                                  (other.trainer_id === apt.trainer_id || 
                                   other.vehicle_id_uuid === apt.vehicle_id_uuid || 
                                   other.cliente_id === apt.cliente_id)
                                );
                                
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
                      {activeAppointment.appointment_time.slice(0, 5)} — {format(addMinutes(parseISO(`${activeAppointment.appointment_date}T${activeAppointment.appointment_time}`), activeAppointment.duration), 'HH:mm')}
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
        onSuccess={async () => {
          setIsNewModalOpen(false);
          setNewModalInitialData(null);
          router.refresh();
          // Small delay to let DB propagate the new record
          await new Promise(r => setTimeout(r, 300));
          await fetchWeekAppointments();
        }}
        initialDate={newModalInitialData?.date}
        initialTime={newModalInitialData?.time}
      />

      {selectedAppointment && (
        selectedAppointment.sessione_esame_id ? (
          <ExamSessionModal
            isOpen={true}
            onClose={() => setSelectedAppointment(null)}
            onSuccess={async () => {
              setSelectedAppointment(null);
              router.refresh();
              await new Promise(r => setTimeout(r, 300));
              await fetchWeekAppointments();
            }}
            sessionId={selectedAppointment.sessione_esame_id}
          />
        ) : (
          <DetailsModal
            isOpen={true}
            onClose={() => setSelectedAppointment(null)}
            onSuccess={async () => {
              setSelectedAppointment(null);
              router.refresh();
              await new Promise(r => setTimeout(r, 300));
              await fetchWeekAppointments();
            }}
            appointmentId={selectedAppointment.id}
          />
        )
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => {
          setIsDatePickerOpen(false);
          datePickerCloseTime = Date.now();
        }}
        selectedDate={currentDate}
        onSelect={(date) => setCurrentDate(date)}
      />
    </>
  );
}
