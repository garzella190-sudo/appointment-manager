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
  StickyNote,
  Maximize2,
  Minimize2,
  SlidersHorizontal
} from 'lucide-react';
import { Modal } from '@/components/Modal';
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
import { ScrollbarOrizzontale } from '@/components/ScrollbarOrizzontale';
import { useAggiornaAlRitorno } from '@/hooks/useAggiornaAlRitorno';
import { DraggableAppointment } from '@/components/DraggableAppointment';
import { RefreshButton } from '@/components/RefreshButton';
import { cn } from '@/lib/utils';
import { Toast } from '@/components/Toast';
import NewAppointmentModal from '@/components/modals/NewAppointmentModal';
import DetailsModal from '@/components/modals/DetailsModal';
import ExamSessionModal from '@/components/modals/ExamSessionModal';

import DatePickerModal from '@/components/modals/DatePickerModal';
import { ConfirmMultiInstructorModal } from '@/components/modals/ConfirmMultiInstructorModal';
import { isItalianHoliday, isWeekend } from '@/utils/holidays';
import { ConflictsAlert } from '@/components/ConflictsAlert';
import { notificaSpostamentoAction } from '@/actions/appointment_actions';

class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: { nativeEvent: PointerEvent }) => {
        // Disattiva il drag & drop su tutti i touch screen (smartphone, tablet, iPad, laptop touch)
        const isTouch = event.pointerType === 'touch' || 
                        (typeof window !== 'undefined' && (
                          ('ontouchstart' in window) ||
                          (navigator.maxTouchPoints > 0) ||
                          window.matchMedia('(pointer: coarse)').matches
                        ));
        if (isTouch) {
          return false; 
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
  const { user, role, isSegreteria, isAdmin, istruttoreId, isIstruttore, loading: authLoading } = useAuth();
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
  /**
   * "Nascondi domenica": nasconde SOLO la domenica dal calendario, il sabato resta
   * sempre visibile. Prima si chiamava "fine settimana" e nascondeva entrambi i giorni.
   */
  const [nascondiDomenica, setNascondiDomenica] = useState(false);
  const [granularity, setGranularity] = useState<15 | 30 | 60>(15);
  const [viewMode, setViewMode] = useState<'week' | 'resource'>('week');
  const [isFullScreen, setIsFullScreen] = useState(false);
  /**
   * UNICO contenitore di scroll del calendario (orizzontale + verticale).
   * Tenere un solo scrollport è ciò che rende possibili insieme:
   * - la colonna degli orari `sticky left-0` (non scorre via in orizzontale)
   * - la fascia giorni/istruttori `sticky top-0` (resta in alto)
   * Con due contenitori annidati la sticky si aggancia a quello interno e si muove
   * insieme alla griglia (bug visto su alcuni browser / PWA installata).
   */
  const grigliaRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  // Su schermi piccoli troppe colonne renderebbero illeggibili le card: massimo 3 istruttori.
  const MAX_ISTRUTTORI_MOBILE = 3;
  const [confirmMultiModal, setConfirmMultiModal] = useState<{
    isOpen: boolean;
    title?: string;
    message?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    onConfirm: () => {}
  });

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
    const savedNascondiDomenica = localStorage.getItem('calendar_nascondiDomenica');
    // Migrazione dalla vecchia preferenza "nascondi weekend" (nascondeva sabato e domenica):
    // chi l'aveva attiva continua a NON vedere la domenica, ma il sabato ricompare.
    const legacyShowWeekends = localStorage.getItem('calendar_showWeekends');
    const savedDate = localStorage.getItem('calendar_currentDate');
    const savedGranularity = localStorage.getItem('calendar_granularity');
    const savedViewMode = localStorage.getItem('calendar_viewMode');

    if (savedInstructorIds) try { setSelectedInstructorIds(JSON.parse(savedInstructorIds)); } catch {}
    if (savedViewDays !== null) setViewDays(parseInt(savedViewDays) as any);
    if (savedNascondiDomenica !== null) {
      setNascondiDomenica(savedNascondiDomenica === 'true');
    } else if (legacyShowWeekends !== null) {
      setNascondiDomenica(legacyShowWeekends === 'false');
    }
    if (savedGranularity !== null) setGranularity(parseInt(savedGranularity) as any);
    if (savedViewMode !== null) setViewMode(savedViewMode as any);
    if (savedDate !== null) {
      try {
        setCurrentDate(new Date(savedDate));
      } catch (e) {
        console.error("Errore nel ripristino della data:", e);
      }
    }

    // Giorni visibili: si rispetta SEMPRE la scelta salvata dall'utente.
    // Il default legato alla larghezza dello schermo si applica solo al primo avvio.
    const defaultViewDaysFor = (width: number): 1 | 3 | 5 | 7 => {
      if (width < 640) return 3;
      if (width < 1024) return 5;
      return 7;
    };
    const savedViewDaysNum = savedViewDays ? parseInt(savedViewDays) : NaN;
    if ([1, 3, 5, 7].includes(savedViewDaysNum)) {
      setViewDays(savedViewDaysNum as 1 | 3 | 5 | 7);
    } else {
      setViewDays(defaultViewDaysFor(window.innerWidth));
    }

    // NB: nessun reset di viewDays al resize, altrimenti la scelta dell'utente
    // verrebbe sovrascritta dal valore letto al montaggio.
    const handleMobileCheck = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleMobileCheck);
    return () => {
      window.removeEventListener('resize', handleMobileCheck);
    };
  }, []);

  // Salvataggio impostazioni in localStorage
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('calendar_selectedInstructorIds', JSON.stringify(selectedInstructorIds));
    localStorage.setItem('calendar_viewDays', viewDays.toString());
    localStorage.setItem('calendar_nascondiDomenica', nascondiDomenica.toString());
    localStorage.setItem('calendar_currentDate', currentDate.toISOString());
    localStorage.setItem('calendar_granularity', granularity.toString());
    localStorage.setItem('calendar_viewMode', viewMode);
  }, [selectedInstructorIds, viewDays, nascondiDomenica, currentDate, granularity, viewMode, mounted]);

  // Calcolo dell'istruttore associato (da metadata o da matching nome/email)
  const resolvedIstruttoreId = useMemo(() => {
    if (istruttoreId) return istruttoreId;
    if (!user || istruttori.length === 0) return null;
    
    const userEmail = user.email?.toLowerCase() || '';
    const userMetaName = (user.user_metadata?.nome || user.user_metadata?.name || '').toLowerCase();
    
    const matched = istruttori.find(i => {
      const iNome = (i.nome || '').toLowerCase();
      const iCognome = (i.cognome || '').toLowerCase();
      return (
        (iNome && userMetaName.includes(iNome)) ||
        (iCognome && userMetaName.includes(iCognome)) ||
        (iNome && userEmail.includes(iNome)) ||
        (iCognome && userEmail.includes(iCognome))
      );
    });
    return matched ? matched.id : null;
  }, [istruttoreId, user, istruttori]);

  // Auto-filter: se l'utente ha un istruttoreId associato, filtralo di default
  const [hasAppliedAutoFilter, setHasAppliedAutoFilter] = useState(false);
  useEffect(() => {
    if (!mounted || authLoading || hasAppliedAutoFilter || istruttori.length === 0) return;
    
    if (isIstruttore && resolvedIstruttoreId) {
      setSelectedInstructorIds([resolvedIstruttoreId]);
    } else {
      const savedInstructorIds = localStorage.getItem('calendar_selectedInstructorIds');
      // '[]' o null sono entrambi considerati "nessuna preferenza"
      const hasRealPreference = savedInstructorIds && savedInstructorIds !== '[]';
      if (!hasRealPreference && resolvedIstruttoreId) {
        setSelectedInstructorIds([resolvedIstruttoreId]);
      }
    }
    setHasAppliedAutoFilter(true);
  }, [mounted, authLoading, resolvedIstruttoreId, isIstruttore, istruttori, hasAppliedAutoFilter]);

  // Auto-switch viewMode: se selezionato esattamente 1 istruttore → week; altrimenti → resource
  // Questo si applica sempre (non dipende da hasAppliedAutoFilter) per garantire no-overlap
  useEffect(() => {
    if (!mounted) return;
    if (selectedInstructorIds.length === 1) {
      setViewMode('week');
    } else if (selectedInstructorIds.length !== 1) {
      setViewMode('resource');
    }
  }, [selectedInstructorIds, mounted]);

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
  /**
   * Passo di navigazione = numero di giorni MOSTRATI (1, 3, 5, 7).
   * Con la vista a 3 giorni il tasto ‹ torna indietro di 3 giorni, non di 1:
   * le frecce devono far avanzare/arretrare di una "schermata" intera.
   * (Definito qui perché serve sia ai tasti ‹ › sia ai listener della fullscreen.)
   */
  const passoGiorni = effectiveViewDays > 0 ? effectiveViewDays : 1;
  // Forza sempre la partenza dal Lunedì come richiesto
  const displayStart = weekStart; 
  const displayDays = useMemo(() => {
    // Vista a 7 giorni: settimana Lun-Dom, oppure Lun-Sab se la domenica è nascosta
    if (viewDays === 7) {
      return Array.from({ length: nascondiDomenica ? 6 : 7 }, (_, i) => addDays(displayStart, i));
    }
    
    // Per 1, 3, 5 giorni, partiamo dalla data corrente e saltiamo la domenica se nascosta
    const days: Date[] = [];
    let d = new Date(currentDate);
    
    // Se il giorno di partenza è la domenica nascosta, si comincia dal lunedì
    if (nascondiDomenica && d.getDay() === 0) {
      d = addDays(d, 1);
    }

    while (days.length < viewDays) {
      // Si salta SOLO la domenica (0): il sabato resta sempre visibile
      if (!nascondiDomenica || d.getDay() !== 0) {
        days.push(new Date(d));
      }
      d = addDays(d, 1);
    }
    return days;
  }, [displayStart, viewDays, nascondiDomenica, currentDate.getTime()]);

  // Generate intervals from 08:00 to 22:00 based on granularity
  const timeSlots = Array.from({ length: Math.floor((14 * 60) / granularity) + 1 }, (_, i) => {
    const totalMinutes = i * granularity;
    const h = Math.floor(totalMinutes / 60) + 8;
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  });

  // Synchronize isFullScreen with BottomNav
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('calendar-fullscreen', { detail: isFullScreen }));
    return () => {
      window.dispatchEvent(new CustomEvent('calendar-fullscreen', { detail: false }));
    };
  }, [isFullScreen]);

  // Handle scroll in fullscreen to hide/show BottomNav
  useEffect(() => {
    if (!isFullScreen) {
      window.dispatchEvent(new CustomEvent('toggle-bottom-nav', { detail: { show: true } }));
      return;
    }

    const container = grigliaRef.current;
    if (!container) return;

    let lastScrollTop = container.scrollTop;
    let isNavVisible = true;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      
      // Determine scroll direction
      if (scrollTop > lastScrollTop && scrollTop > 50) {
        if (isNavVisible) {
          isNavVisible = false;
          window.dispatchEvent(new CustomEvent('toggle-bottom-nav', { detail: { show: false } }));
        }
      } else if (scrollTop < lastScrollTop) {
        if (!isNavVisible) {
          isNavVisible = true;
          window.dispatchEvent(new CustomEvent('toggle-bottom-nav', { detail: { show: true } }));
        }
      }
      lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isFullScreen]);

  // Handle fullscreen navigation events from BottomNav
  useEffect(() => {
    if (!isFullScreen) return;

    const handlePrev = () => {
      // Stesso passo dei tasti ‹ ›: tanti giorni quanti sono quelli mostrati
      setCurrentDate(prev => {
        const next = new Date(prev);
        next.setDate(next.getDate() - passoGiorni);
        return next;
      });
    };

    const handleNext = () => {
      setCurrentDate(prev => {
        const next = new Date(prev);
        next.setDate(next.getDate() + passoGiorni);
        return next;
      });
    };

    const handleToday = () => {
      setCurrentDate(new Date());
    };

    window.addEventListener('calendar-prev', handlePrev);
    window.addEventListener('calendar-today', handleToday);
    window.addEventListener('calendar-next', handleNext);

    return () => {
      window.removeEventListener('calendar-prev', handlePrev);
      window.removeEventListener('calendar-today', handleToday);
      window.removeEventListener('calendar-next', handleNext);
    };
  }, [isFullScreen, passoGiorni]);

  const fetchWeekAppointments = useCallback(async (opzioni?: { silenzioso?: boolean }) => {
    if (!opzioni?.silenzioso) setLoading(true);
    const fetchStartDate = displayDays[0];
    const fetchEndDate = addDays(displayDays[displayDays.length - 1], 1);

    try {
      let apptQuery = supabase
        .from('appuntamenti')
        .select(`
          id, data, durata, stato, note, importo, istruttore_id, veicolo_id, inizio, fine, data_solo, sessione_esame_id,
          clienti ( id, nome, cognome, telefono, preferenza_cambio, patente_richiesta_id, sessione_esame_id, pronto_esame ),
          istruttori ( nome, cognome, colore ),
          veicoli ( id, targa, nome, colore ),
          sessioni_esame ( id, nome, clienti ( id, nome, cognome ) )
        `)
        .gte('data_solo', format(fetchStartDate, 'yyyy-MM-dd'))
        .lt('data_solo', format(fetchEndDate, 'yyyy-MM-dd'));

      if (isIstruttore && istruttoreId) {
        apptQuery = apptQuery.eq('istruttore_id', istruttoreId);
      }

      const [{ data: dbData, error: dbError }, { data: patentiData }, { data: istruttoriData }] = await Promise.all([
        apptQuery,
        supabase.from('patenti').select('id, tipo'),
        supabase.from('istruttori').select('id, nome, cognome').order('cognome')
      ]);

      if (dbError) throw dbError;

      // Costruisce la lista istruttori unendo quelli dalla tabella + quelli negli appuntamenti
      // (per coprire casi dove un istruttore ha appuntamenti ma non compare nella tabella)
      const istruttoriDaAppuntamenti: { id: string; nome: string; cognome: string }[] = [];
      const istruttoriIds = new Set((istruttoriData || []).map((i: any) => i.id));
      for (const row of dbData || []) {
        if (row.istruttore_id && !istruttoriIds.has(row.istruttore_id) && row.istruttori) {
          istruttoriDaAppuntamenti.push({
            id: row.istruttore_id,
            nome: row.istruttori.nome || '',
            cognome: row.istruttori.cognome || '',
          });
          istruttoriIds.add(row.istruttore_id);
        }
      }
      const allIstruttori = [...(istruttoriData || []), ...istruttoriDaAppuntamenti]
        .sort((a: any, b: any) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'));
      setIstruttori(allIstruttori);
      
      const patentiMap = new Map<string, string>((patentiData || []).map((p: any) => [p.id, p.tipo]));

      const mappedAppointments = (dbData || [])
        .filter((row: any) => !(row.note && String(row.note).startsWith('ESITO ESAME:')))
        .map((row: any) => {
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
          exam_status: row.clienti?.sessione_esame_id ? 'scheduled' : (row.clienti?.pronto_esame ? 'ready' : 'none'),
          candidates: row.sessioni_esame?.clienti || [],
          sessione_esame_id: row.sessione_esame_id
        };
      });

      setAppointments(mappedAppointments);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabaseClient, displayDays]);

  // Dati freschi ogni volta che l'app PWA torna in primo piano (senza overlay di caricamento)
  useAggiornaAlRitorno(() => {
    void fetchWeekAppointments({ silenzioso: true });
  });

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
    if (!loading && mounted && grigliaRef.current) {
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

        const container = grigliaRef.current;
        if (!container) return;
        
        // Lo scroll è unico (X+Y): l'intestazione sticky copre la parte alta del viewport,
        // quindi va sottratta per non centrare/posizionare la riga sotto di essa.
        const intestazione = document.querySelector('[data-header-calendario]') as HTMLElement | null;
        const altezzaIntestazione = intestazione?.offsetHeight ?? 0;
        const altezzaUtile = Math.max(120, container.clientHeight - altezzaIntestazione);
        
        let scrollPos = 0;

        if (hasApptNear) {
          const targetSlot = `${targetH.toString().padStart(2, '0')}:${targetM.toString().padStart(2, '0')}`;
          const element = document.getElementById(`slot-${targetSlot}`);
          if (element) {
            scrollPos = element.offsetTop - altezzaIntestazione - (altezzaUtile / 2) + (element.clientHeight / 2);
          }
        } else {
          // Posizionati alle 9 come primo rigo visibile
          const element = document.getElementById(`slot-09:00`);
          if (element) {
            scrollPos = element.offsetTop - altezzaIntestazione - 10;
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

      const targetApt = appointments.find(a => a.id === active.id);
      if (!targetApt) return;

      setAppointments(prev => prev.map(apt => {
        if (apt.id === active.id) {
          return { 
            ...apt, 
            appointment_date: dateStr, 
            appointment_time: timeStr,
            trainer_id: newInstructorId || apt.trainer_id 
          };
        }
        if (targetApt.sessione_esame_id && apt.sessione_esame_id === targetApt.sessione_esame_id) {
          return {
            ...apt,
            appointment_date: dateStr,
            appointment_time: timeStr
          };
        }
        return apt;
      }));

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

      let updateError = null;

      if (targetApt.sessione_esame_id) {
        // 1. Update sessioni_esame table (data and ora_inizio)
        const { error: sessionError } = await supabase
          .from('sessioni_esame')
          .update({
            data: dateStr,
            ora_inizio: timeStr
          })
          .eq('id', targetApt.sessione_esame_id);

        if (sessionError) {
          console.error('Error updating exam session time:', sessionError);
          updateError = sessionError;
        }

        // 2. Update ALL appointments linked to this session
        const { error: sessionAptsError } = await supabase
          .from('appuntamenti')
          .update({
            data: startISO,
            inizio: startISO,
            fine: endISO,
            data_solo: dateStr,
          })
          .eq('sessione_esame_id', targetApt.sessione_esame_id);

        if (sessionAptsError) {
          console.error('Error updating exam session appointments:', sessionAptsError);
          updateError = updateError || sessionAptsError;
        }

        // 3. If instructor changed, update this specific appointment's instructor AND the instructors array in sessioni_esame
        if (newInstructorId && newInstructorId !== targetApt.trainer_id) {
          const { error: instError } = await supabase
            .from('appuntamenti')
            .update({ istruttore_id: newInstructorId })
            .eq('id', active.id as string);

          if (instError) {
            console.error('Error updating dragged exam appointment instructor:', instError);
            updateError = updateError || instError;
          }

          // Fetch current session instructors list
          const { data: sessionData } = await supabase
            .from('sessioni_esame')
            .select('istruttori_ids')
            .eq('id', targetApt.sessione_esame_id)
            .single();

          if (sessionData) {
            const currentIds: string[] = sessionData.istruttori_ids || [];
            const newIds = currentIds.map(id => id === targetApt.trainer_id ? newInstructorId : id);
            await supabase
              .from('sessioni_esame')
              .update({ istruttori_ids: newIds })
              .eq('id', targetApt.sessione_esame_id);
          }
        }
      } else {
        // Normal appointment drag
        const { error: dragError } = await supabase
          .from('appuntamenti')
          .update(updatePayload)
          .eq('id', active.id as string);

        if (dragError) {
          console.error('Drag & Drop save error:', dragError);
          updateError = dragError;
        }
      }

      if (updateError) {
        setToast({
          message: 'Errore durante il salvataggio dello spostamento. Riprova.',
          type: 'error'
        });
      } else {
        // Lo spostamento qui è un update diretto sul database: senza questa chiamata
        // nessuno riceveva la notifica push del movimento.
        try {
          const idsSpostati = targetApt.sessione_esame_id
            ? appointments
                .filter(a => a.sessione_esame_id === targetApt.sessione_esame_id)
                .map(a => a.id)
            : [active.id as string];
          await notificaSpostamentoAction(idsSpostati.length > 0 ? idsSpostati : [active.id as string], 'spostamento');
        } catch (notificaError) {
          console.error('Notifica spostamento non inviata:', notificaError);
        }
      }
      
      if (mounted) fetchWeekAppointments();
    }
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * passoGiorni));
    setCurrentDate(newDate);
  };

  const activeAppointment = appointments.find(a => a.id === activeId);

  // Filtered instructors for resource view
  const displayIstruttori = selectedInstructorIds.length > 0
    ? istruttori.filter(i => selectedInstructorIds.includes(i.id))
    : istruttori;

  // Larghezza delle colonne adattiva:
  // - se le colonne entrano nello spazio del pannello, si allargano fino a riempirlo
  //   (i 7 giorni si vedono tutti, senza scroll);
  // - altrimenti si scende fino alla larghezza minima leggibile e la griglia scorre
  //   orizzontalmente (barra visibile su PC).
  const MIN_COL_WEEK = 96;        // px minimi leggibili per giorno (vista settimana)
  const MIN_COL_RESOURCE = 104;   // px minimi leggibili per istruttore (vista a colonne)
  const MAX_COL = 240;            // oltre questa larghezza la colonna non serve piu' larga
  const TIME_COL_W = 60;          // colonna degli orari

  /** "Adatta allo schermo": nessun minimo, tutto visibile anche se le colonne si stringono */
  const [fitAll, setFitAll] = useState(false);

  const gridColumnsCount = viewMode === 'week'
    ? displayDays.length
    : Math.max(1, displayDays.length * displayIstruttori.length);

  const [larghezzaPannello, setLarghezzaPannello] = useState(0);

  useEffect(() => {
    const el = grigliaRef.current;
    if (!el) return;
    const aggiorna = () => setLarghezzaPannello(el.clientWidth);
    aggiorna();
    const ro = new ResizeObserver(aggiorna);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode, displayDays.length, displayIstruttori.length, isFullScreen]);

  const colLeggibile = viewMode === 'week' ? MIN_COL_WEEK : MIN_COL_RESOURCE;
  const spazioColonne = Math.max(0, larghezzaPannello - TIME_COL_W);
  const colDisponibile = spazioColonne > 0
    ? Math.floor(spazioColonne / Math.max(1, gridColumnsCount))
    : colLeggibile;
  const colWidth = fitAll
    ? Math.max(36, colDisponibile)
    : Math.max(colLeggibile, Math.min(colDisponibile, MAX_COL));
  const minGridWidth = TIME_COL_W + gridColumnsCount * colWidth;

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newModalInitialData, setNewModalInitialData] = useState<{ date: string; time: string; istruttoreId?: string } | null>(null);

  const handleCellClick = (dateStr: string, slot: string, istruttoreId?: string) => {
    if (Date.now() - datePickerCloseTime < 500) return;
    setNewModalInitialData({ date: dateStr, time: slot, istruttoreId });
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
        <div className={cn(
          "flex flex-col h-full w-full overflow-hidden",
          isFullScreen && "fixed inset-0 z-[40] bg-[#F4F4F4] dark:bg-zinc-950 p-2 sm:p-3 pt-12"
        )}>
          {isFullScreen && (
            <button
              type="button"
              onClick={() => setIsFullScreen(false)}
              title="Esci da Schermo Intero"
              className="fixed top-4 right-4 z-50 h-10 w-10 flex items-center justify-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl hover:text-blue-600 dark:hover:text-blue-400 transition-all text-zinc-500 shadow-lg active:scale-95 cursor-pointer"
            >
              <Minimize2 size={18} />
            </button>
          )}
          <header className={cn(
            "relative px-2 sm:px-4 md:px-6 py-2 pb-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4 flex-shrink-0",
            isFullScreen && "hidden"
          )}>
            <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-display">Calendario</h1>
              <RefreshButton onRefresh={fetchWeekAppointments} className="h-8 w-8 p-0" />
              <button
                type="button"
                onClick={() => setIsFullScreen(true)}
                title="Schermo Intero"
                className="h-8 w-8 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl hover:text-blue-600 dark:hover:text-blue-400 transition-all text-zinc-500 shadow-sm cursor-pointer"
              >
                <Maximize2 size={16} />
              </button>
            </div>
              <p className="text-zinc-600 dark:text-zinc-300 mt-1 capitalize text-base sm:text-lg font-bold tracking-tight leading-none">
                {viewMode === 'resource' 
                  ? format(currentDate, 'EEEE d MMMM yyyy', { locale: it })
                  : format(weekStart, 'MMMM yyyy', { locale: it })
                }
              </p>
            </div>

            {/* Row 1: View mode + day selector */}
            <div className="relative lg:static flex flex-row items-center justify-center gap-1.5 sm:gap-3 w-full lg:flex-1 mt-1 lg:mt-0">
              {/* Tasto unico: apre il sottomenu con chi / quanti giorni / weekend */}
              <button
                type="button"
                onClick={() => setShowFilter(!showFilter)}
                title="Scegli chi visualizzare, quanti giorni e il weekend"
                className={cn(
                  "h-10 sm:h-9 shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all shadow-sm border whitespace-nowrap absolute left-0 lg:static lg:ml-auto",
                  showFilter || selectedInstructorIds.length > 0 || viewMode === 'resource'
                    ? "bg-sky-100 dark:bg-sky-900 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-sky-600"
                )}
              >
                <SlidersHorizontal size={16} className="shrink-0" />
                <span className="hidden sm:inline">Visualizzazione</span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[9px] font-black",
                    showFilter || selectedInstructorIds.length > 0 || viewMode === 'resource'
                      ? "bg-white/70 dark:bg-zinc-900/60"
                      : "bg-zinc-100 dark:bg-zinc-800"
                  )}
                >
                  {viewMode === 'resource' ? 'COL' : `${viewDays}G`}
                </span>
              </button>

                <div className="flex items-center shrink-0 h-11 sm:h-10 gap-0.5 sm:gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-0.5 sm:p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-inner lg:absolute lg:left-1/2 lg:-translate-x-1/2">
                  <button
                    onClick={() => navigateWeek(-1)}
                    title={passoGiorni === 1 ? 'Giorno precedente' : `${passoGiorni} giorni precedenti`}
                    className="h-9 w-8 sm:h-8 sm:w-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    title="Vai a oggi"
                    className="px-1.5 sm:px-3 h-9 sm:h-8 text-[10px] sm:text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider hover:text-blue-600 transition-all flex items-center whitespace-nowrap"
                  >
                    {displayDays.some(d => isToday(d)) ? 'Oggi' : format(currentDate, 'd MMM', { locale: it })}
                  </button>
                  <button
                    onClick={() => navigateWeek(1)}
                    title={passoGiorni === 1 ? 'Giorno successivo' : `${passoGiorni} giorni successivi`}
                    className="h-9 w-8 sm:h-8 sm:w-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400"
                  >
                    <ChevronRight size={18} />
                  </button>
                  
                  <div className="hidden sm:block w-[1px] h-5 bg-zinc-200 dark:bg-zinc-700/50 mx-0.5"></div>
                  
                  <button
                    onClick={() => setIsDatePickerOpen(true)}
                    className="h-9 w-8 sm:h-8 sm:w-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 hover:text-blue-600 dark:text-zinc-400 focus:outline-none cursor-pointer"
                    title="Scegli una data"
                  >
                    <CalendarIcon size={18} />
                  </button>
                </div>
            </div>

            <Modal
              isOpen={showFilter}
              onClose={() => setShowFilter(false)}
              title="Visualizzazione"
            >
              <div className="space-y-5 pb-1">
                {/* QUANTI GIORNI */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Quanti giorni</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 3, 5, 7].map((days) => (
                      <button
                        key={days}
                        onClick={() => setViewDays(days as 1 | 3 | 5 | 7)}
                        className={cn(
                          "h-11 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border active:scale-95",
                          viewDays === days
                            ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800 shadow-sm"
                            : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                        )}
                      >
                        {days} G
                      </button>
                    ))}
                  </div>
                  {viewMode === 'resource' && (
                    <p className="text-[10px] text-zinc-400 font-bold mt-2 ml-1">
                      Vista più istruttori: giorni affiancati in orizzontale; se le colonne sono tante la griglia scorre.
                    </p>
                  )}
                  {isMobile && (
                    <p className="text-[10px] text-amber-500 font-bold mt-1 ml-1">
                      Su mobile puoi selezionare al massimo {MAX_ISTRUTTORI_MOBILE} istruttori.
                    </p>
                  )}
                </div>

                {/* CHI VISUALIZZARE */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Chi visualizzare</p>
                  <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (isMobile) {
                        // Su mobile "Tutti" seleziona al massimo i primi 3 istruttori
                        const primi = [...istruttori]
                          .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'))
                          .slice(0, MAX_ISTRUTTORI_MOBILE)
                          .map(x => x.id);
                        setSelectedInstructorIds(primi);
                        setViewMode('resource');
                        if (istruttori.length > MAX_ISTRUTTORI_MOBILE) {
                          setToast({ message: `Su mobile puoi visualizzare al massimo ${MAX_ISTRUTTORI_MOBILE} istruttori`, type: 'error' });
                        }
                        return;
                      }
                      if (selectedInstructorIds.length === 1) {
                        setConfirmMultiModal({
                          isOpen: true,
                          title: "Visualizza Più Istruttori",
                          message: "Sei sicuro di voler visualizzare il calendario di tutti gli istruttori contemporaneamente? La schermata passerà alla vista a colonne.",
                          onConfirm: () => {
                            setSelectedInstructorIds([]);
                            setViewMode('resource');
                            setConfirmMultiModal(prev => ({ ...prev, isOpen: false }));
                          }
                        });
                        return;
                      }
                      setSelectedInstructorIds([]);
                      setViewMode('resource');
                    }}
                    className={cn(
                      "h-10 px-4 flex items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border active:scale-95",
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
                            const applica = (next: string[]) => {
                              if (isMobile && next.length > MAX_ISTRUTTORI_MOBILE) {
                                setToast({ message: `Su mobile puoi visualizzare al massimo ${MAX_ISTRUTTORI_MOBILE} istruttori`, type: 'error' });
                                return;
                              }
                              setSelectedInstructorIds(next);
                              // Auto-switch view mode: se 1 solo istruttore → week, altrimenti → resource
                              setViewMode(next.length === 1 ? 'week' : 'resource');
                            };

                            if (selectedInstructorIds.length === 1 && !selectedInstructorIds.includes(i.id)) {
                              setConfirmMultiModal({
                                isOpen: true,
                                title: "Visualizza Più Istruttori",
                                message: `Vuoi visualizzare il calendario di più istruttori contemporaneamente? I calendari verranno affiancati nella vista a colonne.`,
                                onConfirm: () => {
                                  applica([...selectedInstructorIds, i.id]);
                                  setConfirmMultiModal(prev => ({ ...prev, isOpen: false }));
                                }
                              });
                              return;
                            }

                            let next: string[];
                            if (selectedInstructorIds.length === 0) {
                              next = [i.id];
                            } else if (selectedInstructorIds.includes(i.id)) {
                              next = selectedInstructorIds.filter(id => id !== i.id);
                            } else {
                              next = [...selectedInstructorIds, i.id];
                            }
                            applica(next);
                          }}
                          className={cn(
                            "h-10 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border active:scale-95 flex items-center gap-1.5",
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
                </div>

                {/* DOMENICA */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Domenica</p>
                  <button
                    onClick={() => setNascondiDomenica(!nascondiDomenica)}
                    className={cn(
                      "h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border active:scale-95 flex items-center justify-center gap-2",
                      nascondiDomenica
                        ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800"
                        : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                    )}
                  >
                    {nascondiDomenica ? 'Mostra domenica' : 'Nascondi domenica'}
                  </button>
                  <p className="text-[10px] text-zinc-400 font-bold mt-2 ml-1">
                    Nasconde solo la domenica: il sabato resta sempre visibile.
                  </p>
                </div>

                {/* LARGHEZZA COLONNE */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Larghezza</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFitAll(true)}
                      className={cn(
                        "h-11 flex-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border active:scale-95 flex items-center justify-center gap-1.5",
                        fitAll
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-300 dark:border-sky-800"
                          : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                      )}
                    >
                      <Minimize2 size={14} className="shrink-0" />
                      Adatta tutto
                    </button>
                    <button
                      onClick={() => setFitAll(false)}
                      className={cn(
                        "h-11 flex-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border active:scale-95 flex items-center justify-center gap-1.5",
                        !fitAll
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-300 dark:border-sky-800"
                          : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                      )}
                    >
                      <Maximize2 size={14} className="shrink-0" />
                      Colonne leggibili
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-bold mt-2 ml-1">
                    {fitAll
                      ? 'Tutti i giorni entrano nello schermo, colonne più strette.'
                      : 'Colonne larghe e leggibili: se non entrano, scorri in orizzontale.'}
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (selectedInstructorIds.length === 1) {
                      setConfirmMultiModal({
                        isOpen: true,
                        title: "Visualizza Più Istruttori",
                        message: "Vuoi visualizzare il calendario di tutti gli istruttori contemporaneamente? La schermata passerà alla vista a colonne.",
                        onConfirm: () => {
                          setSelectedInstructorIds([]);
                          setViewMode('resource');
                          setShowFilter(false);
                          setConfirmMultiModal(prev => ({ ...prev, isOpen: false }));
                        }
                      });
                      return;
                    }
                    setViewMode('resource');
                    setShowFilter(false);
                  }}
                  className="h-11 px-4 w-full bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-wider border border-zinc-200 dark:border-zinc-700 active:scale-95 transition-all flex items-center gap-2 justify-center"
                >
                  <Users size={14} />
                  Vista istruttori a colonne
                </button>

                <button
                  onClick={() => setShowFilter(false)}
                  className="h-12 px-4 w-full bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md border border-indigo-500 active:scale-95 transition-all flex items-center gap-2 justify-center"
                >
                  Conferma
                </button>
              </div>
            </Modal>
          </header>

          <ConflictsAlert />

          <div
            className="flex-1 px-0.5 sm:px-1 md:px-2 pb-2 md:pb-4 overflow-hidden flex flex-col"
          >
            <div className="bg-white dark:bg-zinc-900/80 rounded-t-[24px] sm:rounded-t-[32px] md:rounded-t-[40px] shadow-2xl shadow-blue-500/5 border border-zinc-100 dark:border-zinc-800 overflow-hidden flex flex-col h-full rounded-b-[24px] sm:rounded-b-[32px] md:rounded-b-[40px] scrollbar-hide relative">
              <ScrollbarOrizzontale
                targetRef={grigliaRef}
                versione={`${viewMode}-${displayDays.length}-${displayIstruttori.length}-${Math.round(colWidth)}-${fitAll ? 'fit' : 'wide'}`}
              />
              {/* Unico scrollport (X e Y): colonna orari sticky a sinistra e intestazioni sticky in alto */}
              <div ref={grigliaRef} className="w-full flex-1 min-h-0 overflow-auto scrollbar-hide">
                <div className="flex flex-col" style={{ minWidth: minGridWidth }}>
              {/*
                BARRA GIORNI+ISTRUTTORI sticky. Il suo z-index deve stare SOPRA tutte le
                righe orarie, che hanno z-index decrescenti (`timeSlots.length - indice`,
                es. 57 per le 08:00, e 80 per la riga dell'ora corrente): con un valore
                più basso (era z-40) le righe della mattina — quelle con z-index alto —
                si disegnavano SOPRA la barra, facendola sembrare trasparente e lasciando
                passare le card. Resta sotto il DragOverlay (z 100).
              */}
              <div data-header-calendario className="sticky top-0 z-[90] flex flex-col border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex-shrink-0">
                {/* Fascia giorni — vista risorse con più giorni: giorni affiancati in orizzontale */}
                {viewMode === 'resource' && displayDays.length > 1 && (
                  <div
                    className="flex border-b border-zinc-200 dark:border-zinc-800"
                  >
                    <div className="sticky left-0 z-50 w-[60px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900" />
                    {displayDays.map((day: Date) => {
                      const isHoliday = isItalianHoliday(day) || isWeekend(day);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div
                          key={`giorno-${day.toString()}`}
                          className={cn(
                            "flex-1 min-w-0 py-1 text-center border-r border-zinc-200 dark:border-zinc-800 last:border-0 border-l-2 border-l-zinc-400 dark:border-l-zinc-600",
                            isToday ? "bg-blue-50/60 dark:bg-blue-500/10" : ""
                          )}
                        >
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-wider",
                            isHoliday ? "text-red-500" : isToday ? "text-blue-600 dark:text-blue-400" : "text-zinc-500"
                          )}>
                            {format(day, 'EEE d MMM', { locale: it })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex">
                  <div className="sticky left-0 z-50 w-[60px] shrink-0 p-1 sm:p-4 border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
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
                      "flex-1 min-w-0 p-1 sm:p-2 text-center border-r border-zinc-200 dark:border-zinc-800 last:border-0",
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
                }) : displayDays.flatMap((day: Date) => displayIstruttori.map((ist: any, istIdx: number) => {
                  const istColor = appointments.find(a => a.trainer_id === ist.id)?.istruttore?.color || '#3b82f6';
                  const isTodayCol = isSameDay(day, new Date());
                  return (
                    <div
                      key={`${day.toString()}-${ist.id}`}
                      className={cn(
                        "flex-1 min-w-0 py-1 px-0.5 text-center border-r border-zinc-200 dark:border-zinc-800 last:border-0 flex flex-col items-center justify-center",
                        isTodayCol && "bg-blue-50/40 dark:bg-blue-500/5",
                        istIdx === 0 && "border-l-2 border-l-zinc-400 dark:border-l-zinc-600"
                      )}
                    >
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black text-white shadow-sm mb-0.5" style={{ backgroundColor: istColor }}>
                        {ist.cognome?.[0] || '?'}{ist.nome?.[0] || ''}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-tight text-zinc-700 dark:text-zinc-300 truncate w-full leading-tight">
                        {ist.cognome}
                      </span>
                    </div>
                  );
                }))}
                </div>
              </div>

              {/* Corpo Scorrevole */}
              {/*
                Corpo della griglia: NESSUN overflow proprio (l'unico scrollport è più sopra).
                Così le celle `sticky left-0` restano ancorate al bordo sinistro anche su iOS.
              */}
              <div className="pb-24">
                {loading && (
                  <div className="fixed inset-0 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-[2px] z-[90] flex items-center justify-center">
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
                          isFullHour ? "border-zinc-300 dark:border-zinc-700 border-b" : "border-zinc-200 dark:border-zinc-800/60 border-b"
                        )}
                        style={{ 
                          gridTemplateColumns: `60px repeat(${viewMode === 'week' ? displayDays.length : Math.max(1, displayDays.length * displayIstruttori.length)}, minmax(0, 1fr))`,
                          zIndex: isCurrentSlot ? 80 : timeSlots.length - timeSlots.indexOf(slot),
                        } as React.CSSProperties}
                      >
                      {isCurrentSlot && hasToday && (
                        <div 
                          className="absolute left-0 right-0 z-50 flex items-center pointer-events-none"
                          style={{ top: `${((currentTotalMinutes - slotStartMinutes) / granularity) * 100}%`, transform: 'translateY(-50%)' }}
                        >
                          <div className="sticky left-0 z-[60] w-[60px] flex justify-end pr-1 sm:pr-3 bg-white dark:bg-zinc-900">
                            <span className="text-[10px] font-black text-red-500 bg-white dark:bg-zinc-900 px-1 rounded-sm shadow-sm">{format(nowLine, 'HH:mm')}</span>
                          </div>
                          <div className="flex-1 h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] flex relative">
                            <div className="absolute left-0 w-2 h-2 rounded-full bg-red-500 top-1/2 -translate-y-1/2"></div>
                          </div>
                        </div>
                      )}

                      {/*
                        Colonna degli ORARI FISSA a sinistra: `sticky left-0` dentro il contenitore
                        che scorre in orizzontale, così l'orario resta sempre leggibile anche
                        scorrendo giorni/istruttori. Serve un fondo opaco, altrimenti le card
                        passano sotto ai numeri.
                      */}
                      <div className={cn(
                        "sticky left-0 z-[70] p-1 sm:p-2 text-xs sm:text-sm font-mono text-center sm:text-right border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-center sm:justify-end pr-1 sm:pr-4",
                        isFullHour
                          ? "font-black text-zinc-900 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900"
                          : "text-zinc-500 font-semibold bg-white dark:bg-zinc-900"
                      )}>
                        {isFullHour ? slot : slot.split(':')[1]}
                      </div>
                      {viewMode === 'week' ? displayDays.map((day: Date) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const cellId = `${dateStr}|${slot}`;
                        const cellBorderClass = undefined;
                        
                        const dayAppointments = appointments.filter(a => a.appointment_date === dateStr);
                        const slotStartTime = slot; // "HH:mm"
                        const slotEndTime = format(addMinutes(parseISO(`2000-01-01T${slot}`), granularity), "HH:mm");
                        
                        const processedDayAppointments = dayAppointments.map(apt => {
                          if (apt.stato !== 'annullato') {
                            return { ...apt, isVisible: true, visualDuration: apt.duration };
                          }
                          
                          const aptStart = new Date(`${apt.appointment_date}T${apt.appointment_time}`).getTime();
                          const aptEnd = aptStart + apt.duration * 60000;
                          
                          const overlappingActive = dayAppointments
                            .filter(other => 
                              other.stato !== 'annullato' &&
                              other.trainer_id === apt.trainer_id
                            )
                            .map(other => {
                              const start = new Date(`${other.appointment_date}T${other.appointment_time}`).getTime();
                              const end = start + other.duration * 60000;
                              return { start, end };
                            })
                            .filter(other => other.start < aptEnd && other.end > aptStart);
                            
                          if (overlappingActive.length === 0) {
                            return { ...apt, isVisible: true, visualDuration: apt.duration };
                          }
                          
                          const hasImmediateOverlap = overlappingActive.some(other => other.start <= aptStart);
                          if (hasImmediateOverlap) {
                            return { ...apt, isVisible: false };
                          }
                          
                          const nextStarts = overlappingActive
                            .filter(other => other.start > aptStart)
                            .map(other => other.start);
                            
                          if (nextStarts.length > 0) {
                            const nextStart = Math.min(...nextStarts);
                            const emptySpaceDuration = (nextStart - aptStart) / 60000;
                            if (emptySpaceDuration > 0) {
                              return { ...apt, isVisible: true, visualDuration: emptySpaceDuration };
                            }
                          }
                          
                          return { ...apt, isVisible: false };
                        });

                        const cellAppointments = processedDayAppointments
                          .filter(apt => {
                            if (!apt.isVisible) return false;
                            const aptTime = apt.appointment_time.slice(0, 5);
                            return (
                              aptTime >= slotStartTime && 
                              aptTime < slotEndTime &&
                              (selectedInstructorIds.length === 0 || selectedInstructorIds.includes(apt.trainer_id))
                            );
                          })
                          .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

                        // Raggruppa gli appuntamenti della cella per l'ora esatta di inizio
                        const appointmentsByTime: { [time: string]: typeof cellAppointments } = {};
                        cellAppointments.forEach(apt => {
                          const time = apt.appointment_time.slice(0, 5);
                          if (!appointmentsByTime[time]) {
                            appointmentsByTime[time] = [];
                          }
                          appointmentsByTime[time].push(apt);
                        });
                        const sortedTimes = Object.keys(appointmentsByTime).sort();

                        return (
                          <DroppableCell key={cellId} id={cellId} className={cellBorderClass}>
                            <div 
                              className="w-full flex flex-col gap-1 relative cursor-pointer min-h-[40px] select-none"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCellClick(dateStr, slot);
                              }}
                            >
                              {sortedTimes.map((time) => {
                                const group = appointmentsByTime[time];
                                return (
                                  <div key={time} className="w-full flex flex-row gap-1">
                                    {group.map((apt, idx) => {
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
                                          className="relative flex-1 min-w-0"
                                        >
                                          <DraggableAppointment
                                            appointment={apt}
                                            isOverlapping={hasConflict}
                                            onClick={setSelectedAppointment}
                                            isStacked={false}
                                            granularity={15}
                                            isFirst={idx === 0}
                                            totalColumns={group.length}
                                            compatta={colWidth < 150}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          </DroppableCell>
                        );
                      }) : displayDays.flatMap((day: Date) => displayIstruttori.map((ist: any, istIdx: number) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const cellId = `${dateStr}|${slot}|${ist.id}`;
                        // Separatore verticale marcato all'inizio di ogni gruppo-giorno
                        const cellBorderClass = istIdx === 0 ? 'border-l-2 border-l-zinc-400 dark:border-l-zinc-600' : undefined;
                        
                        const dayAppointments = appointments.filter(a => a.appointment_date === dateStr);
                        const slotStartTime = slot;
                        const slotEndTime = format(addMinutes(parseISO(`2000-01-01T${slot}`), granularity), "HH:mm");
                        
                        const processedDayAppointments = dayAppointments.map(apt => {
                          if (apt.stato !== 'annullato') {
                            return { ...apt, isVisible: true, visualDuration: apt.duration };
                          }
                          
                          const aptStart = new Date(`${apt.appointment_date}T${apt.appointment_time}`).getTime();
                          const aptEnd = aptStart + apt.duration * 60000;
                          
                          const overlappingActive = dayAppointments
                            .filter(other => 
                              other.stato !== 'annullato' &&
                              other.trainer_id === apt.trainer_id
                            )
                            .map(other => {
                              const start = new Date(`${other.appointment_date}T${other.appointment_time}`).getTime();
                              const end = start + other.duration * 60000;
                              return { start, end };
                            })
                            .filter(other => other.start < aptEnd && other.end > aptStart);
                            
                          if (overlappingActive.length === 0) {
                            return { ...apt, isVisible: true, visualDuration: apt.duration };
                          }
                          
                          const hasImmediateOverlap = overlappingActive.some(other => other.start <= aptStart);
                          if (hasImmediateOverlap) {
                            return { ...apt, isVisible: false };
                          }
                          
                          const nextStarts = overlappingActive
                            .filter(other => 		other.start > aptStart)
                            .map(other => other.start);
                            
                          if (nextStarts.length > 0) {
                            const nextStart = Math.min(...nextStarts);
                            const emptySpaceDuration = (nextStart - aptStart) / 60000;
                            if (emptySpaceDuration > 0) {
                              return { ...apt, isVisible: true, visualDuration: emptySpaceDuration };
                            }
                          }
                          
                          return { ...apt, isVisible: false };
                        });

                        const cellAppointments = processedDayAppointments
                          .filter(apt => {
                            if (!apt.isVisible) return false;
                            const aptTime = apt.appointment_time.slice(0, 5);
                            return (
                              aptTime >= slotStartTime && 
                              aptTime < slotEndTime &&
                              apt.trainer_id === ist.id
                            );
                          })
                          .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

                        // Raggruppa gli appuntamenti della cella per l'ora esatta di inizio
                        const appointmentsByTime: { [time: string]: typeof cellAppointments } = {};
                        cellAppointments.forEach(apt => {
                          const time = apt.appointment_time.slice(0, 5);
                          if (!appointmentsByTime[time]) {
                            appointmentsByTime[time] = [];
                          }
                          appointmentsByTime[time].push(apt);
                        });
                        const sortedTimes = Object.keys(appointmentsByTime).sort();

                        return (
                          <DroppableCell key={cellId} id={cellId} className={cellBorderClass}>
                            <div 
                              className="w-full flex flex-col gap-1 relative cursor-pointer min-h-[40px] select-none"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCellClick(dateStr, slot, ist.id);
                              }}
                            >
                              {sortedTimes.map((time) => {
                                const group = appointmentsByTime[time];
                                return (
                                  <div key={time} className="w-full flex flex-row gap-1">
                                    {group.map((apt, idx) => {
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
                                          className="relative flex-1 min-w-0"
                                        >
                                          <DraggableAppointment
                                            appointment={apt}
                                            isOverlapping={hasConflict}
                                            onClick={setSelectedAppointment}
                                            isStacked={false}
                                            granularity={15}
                                            isFirst={idx === 0}
                                            totalColumns={group.length}
                                            compatta={colWidth < 150}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          </DroppableCell>
                        );
                      }))}
                    </div>
                  );
                })}
            </div>
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
        initialIstruttoreId={newModalInitialData?.istruttoreId}
      />

      {selectedAppointment && (
        selectedAppointment.sessione_esame_id ? (
          <ExamSessionModal
            isOpen={true}
            onClose={() => setSelectedAppointment(null)}
            onSuccess={async () => {
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

      <ConfirmMultiInstructorModal
        isOpen={confirmMultiModal.isOpen}
        title={confirmMultiModal.title}
        message={confirmMultiModal.message}
        onConfirm={confirmMultiModal.onConfirm}
        onCancel={() => setConfirmMultiModal(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}
