'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { startOfWeek, addDays, format, isSameDay, parseISO, startOfDay, addMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import { createClient } from '@/utils/supabase/client';
import { Appointment } from '@/types';
import { DroppableCell } from '@/components/DroppableCell';
import { DraggableAppointment } from '@/components/DraggableAppointment';
import { cn } from '@/lib/utils';
import { Toast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { AppointmentForm } from '@/components/forms/AppointmentForm';
import { User, Car, Clock, FileText, Phone, Calendar as CalendarIconSmall } from 'lucide-react';
import { AppointmentDetails } from '@/components/calendar/AppointmentDetails';

export default function CalendarPage() {
  const supabase = createClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isEditingAppointment, setIsEditingAppointment] = useState(false);
  const [viewDays, setViewDays] = useState<1 | 3 | 5 | 7>(7);

  // Usa l'hook per gestire responsive in modo solido dopo l'idratazione
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewDays(3);
      } else {
        setViewDays(7);
      }
    };
    handleResize(); // Chiamata iniziale
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  // Per evitare scatti in fase di caricamento dal server
  const effectiveViewDays = mounted ? viewDays : 7; 
  const displayStart = effectiveViewDays === 7 ? weekStart : currentDate;
  const displayDays = Array.from({ length: effectiveViewDays }, (_, i) => addDays(displayStart, i));

  // Generate 15-minute intervals from 08:00 to 20:00
  const timeSlots = Array.from({ length: 12 * 4 + 1 }, (_, i) => {
    const totalMinutes = i * 15;
    const h = Math.floor(totalMinutes / 60) + 8;
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  });

  const fetchWeekAppointments = async () => {
    setLoading(true);
    const fetchEndDate = addDays(displayStart, effectiveViewDays);

    try {
      const [{ data: dbData, error: dbError }, { data: patentiData }] = await Promise.all([
        supabase
          .from('appuntamenti')
          .select(`
            id, data, durata, stato, note, importo,
            clienti ( nome, cognome, telefono, preferenza_cambio, patente_richiesta_id ),
            istruttori ( nome, cognome ),
            veicoli ( targa, nome )
          `)
          .gte('data', displayStart.toISOString())
          .lt('data', fetchEndDate.toISOString()),
        supabase.from('patenti').select('id, tipo')
      ]);

      if (dbError) throw dbError;

      const patentiMap = new Map((patentiData || []).map((p: any) => [p.id, p.tipo]));

      const mappedAppointments = (dbData || []).map((row: any) => {
        const rowDate = new Date(row.data);
        const patenteId = row.clienti?.patente_richiesta_id;
        
        return {
          id: row.id,
          appointment_date: format(rowDate, 'yyyy-MM-dd'),
          appointment_time: format(rowDate, 'HH:mm'),
          client_name: row.clienti ? `${row.clienti.cognome} ${row.clienti.nome}` : 'Sconosciuto',
          phone: row.clienti?.telefono || '',
          trainer_id: row.istruttore_id,
          vehicle_id: row.veicoli ? `${row.veicoli.nome} (${row.veicoli.targa})` : 'Nessuno',
          duration: row.durata,
          notes: row.note,
          status: row.stato,
          stato: row.stato,
          cost: row.importo || 0,
          license_type: patenteId ? (patentiMap.get(patenteId) || 'B') : 'B',
          gearbox_type: row.clienti?.preferenza_cambio === 'automatico' ? 'Automatico' : 'Manuale',
          trainers: {
            name: row.istruttori ? `${row.istruttori.cognome} ${row.istruttori.nome}` : 'Non ass.',
            color: '#3b82f6'
          }
        };
      });

      setAppointments(mappedAppointments as Appointment[]);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) fetchWeekAppointments();
  }, [currentDate, effectiveViewDays, mounted]);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: any) => {
    setOverId(event.over?.id || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (over && active.id !== over.id) {
      const [dateStr, timeStr] = (over.id as string).split('|');
      const formattedDate = format(parseISO(dateStr), 'dd/MM/yyyy');

      // Show move info
      setToast({
        message: `Spostato al ${formattedDate} alle ore ${timeStr}`,
        type: 'success'
      });

      // Update local state immediately for snappy feel
      setAppointments(prev => prev.map(apt => {
        if (apt.id === active.id) {
          return { ...apt, appointment_date: dateStr, appointment_time: timeStr };
        }
        return apt;
      }));

      // Update Supabase
      const startDateTime = new Date(`${dateStr}T${timeStr}`).toISOString();
      const { error } = await supabase
        .from('appuntamenti')
        .update({ data: startDateTime })
        .eq('id', active.id);

      if (error) {
        console.error('Error updating appointment position:', error);
        if (mounted) fetchWeekAppointments(); // Revert on error
      }
    }
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * (effectiveViewDays === 7 ? 7 : effectiveViewDays)));
    setCurrentDate(newDate);
  };

  const activeAppointment = appointments.find(a => a.id === activeId);

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;
    if (window.confirm('Sei sicuro di voler eliminare questo appuntamento?')) {
      const { error } = await supabase
        .from('appuntamenti')
        .delete()
        .eq('id', selectedAppointment.id);

      if (!error) {
        setSelectedAppointment(null);
        if (mounted) fetchWeekAppointments();
        setToast({ message: 'Appuntamento eliminato', type: 'success' });
      } else {
        setToast({ message: 'Errore durante l\'eliminazione', type: 'error' });
      }
    }
  };

  const handleConfirmCancel = async () => {
    if (!selectedAppointment) return;

    const { error } = await supabase
      .from('appuntamenti')
      .update({ 
        stato: 'annullato', 
        note: cancelReason 
          ? `${selectedAppointment.notes || ''}\n\nMotivo annullamento: ${cancelReason}`.trim() 
          : selectedAppointment.notes 
      })
      .eq('id', selectedAppointment.id);

    if (!error) {
      setSelectedAppointment(null);
      setShowCancelReason(false);
      setCancelReason('');
      if (mounted) fetchWeekAppointments();
      setToast({ message: 'Appuntamento annullato', type: 'success' });
    } else {
      setToast({ message: 'Errore durante l\'annullamento', type: 'error' });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      modifiers={[snapCenterToCursor]}
    >
      <div className="p-4 sm:p-6 md:p-10 animate-fade-in max-w-7xl mx-auto">
        <header className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-display">Calendario</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1 capitalize">
              {format(weekStart, 'MMMM yyyy', { locale: it })}
            </p>
          </div>

          <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
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
                className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-600 dark:text-zinc-400"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 text-sm font-bold text-zinc-900 dark:text-zinc-100"
              >
                Oggi
              </button>
              <button
                onClick={() => navigateWeek(1)}
                className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-600 dark:text-zinc-400"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="bg-white dark:bg-zinc-900/80 rounded-[40px] shadow-2xl shadow-blue-500/5 border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          {/* Header Giorni */}
          <div 
            className="grid border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30"
            style={{ gridTemplateColumns: `60px repeat(${viewDays}, minmax(0, 1fr))` }}
          >
            <div className="p-1 sm:p-4 border-r border-zinc-100 dark:border-zinc-800 flex items-center justify-center">
              <Clock size={16} className="text-zinc-400" />
            </div>
            {displayDays.map(day => (
              <div key={day.toString()} className={cn(
                "p-4 text-center border-r border-zinc-100 dark:border-zinc-800 last:border-0",
                isSameDay(day, new Date()) ? "bg-blue-50/50 dark:bg-blue-500/10" : ""
              )}>
                <span className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider font-mono">
                  {format(day, 'eee', { locale: it })}
                </span>
                <span className={cn(
                  "text-lg font-black mt-1 inline-flex w-10 h-10 items-center justify-center rounded-full transition-all",
                  isSameDay(day, new Date()) ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-zinc-900 dark:text-zinc-50"
                )}>
                  {format(day, 'd')}
                </span>
              </div>
            ))}
          </div>

          {/* Griglia Oraria */}
          <div className="overflow-y-auto max-h-[700px] relative scrollbar-hide">
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
                  className={cn(
                    "grid border-b last:border-0 h-10 transition-colors",
                    isFullHour ? "border-zinc-200 dark:border-zinc-700" : "border-zinc-100/50 dark:border-zinc-800/30"
                  )}
                  style={{ gridTemplateColumns: `60px repeat(${viewDays}, minmax(0, 1fr))` }}
                >
                  <div className={cn(
                    "p-1 sm:p-2 text-xs sm:text-sm font-mono text-center sm:text-right border-r border-zinc-100 dark:border-zinc-800 flex items-center justify-center sm:justify-end pr-1 sm:pr-4",
                    isFullHour ? "font-black text-zinc-900 dark:text-zinc-300 bg-zinc-50/50 dark:bg-zinc-800/20" : "text-zinc-500 font-semibold"
                  )}>
                    {isFullHour ? slot : slot.split(':')[1]}
                  </div>
                  {displayDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const cellId = `${dateStr}|${slot}`;
                    const cellAppointments = appointments.filter(a =>
                      a.appointment_date === dateStr && a.appointment_time.slice(0, 5) === slot
                    );

                    return (
                      <DroppableCell key={cellId} id={cellId}>
                        <div className="h-full w-full flex gap-0.5 p-0.5">
                          {cellAppointments.map((apt, idx) => (
                            <div
                              key={apt.id}
                              className={cn(
                                "relative flex-1 min-w-[30px]",
                                (apt as any).stato === 'annullato' && "opacity-70 grayscale [&>div]:!bg-red-500/10 [&>div]:!text-red-700/60 [&>div]:!border-red-500/20 [&>*]:!line-through dark:[&>div]:!bg-red-900/20 dark:[&>div]:!text-red-400"
                              )}
                              style={{
                                zIndex: cellAppointments.length - idx
                              }}
                            >
                              <DraggableAppointment
                                appointment={apt}
                                isOverlapping={cellAppointments.length > 1}
                                onClick={setSelectedAppointment}
                              />
                            </div>
                          ))}
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
              {/* Draggable Preview */}
              <div
                className="w-48 p-4 rounded-2xl text-white shadow-2xl border border-white/20 ring-4 ring-black/5"
                style={{
                  backgroundColor: activeAppointment.trainers?.color || '#3b82f6',
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
                <p className="text-sm font-black leading-tight truncate">{activeAppointment.client_name}</p>
              </div>

              {/* Real-time Indicator Tooltip - Perfectly centered over the 48w (192px) container */}
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

        {selectedAppointment && (
          <Modal
            isOpen={!!selectedAppointment}
            onClose={() => {
              setSelectedAppointment(null);
              setShowCancelReason(false);
              setCancelReason('');
              setIsEditingAppointment(false);
            }}
            title={isEditingAppointment ? "Modifica Appuntamento" : "Dettagli Appuntamento"}
          >
            {isEditingAppointment ? (
              <div className="p-2 sm:p-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 shadow-sm mt-2">
                <AppointmentForm
                  appointmentId={selectedAppointment.id}
                  onSuccess={() => {
                    setIsEditingAppointment(false);
                    setSelectedAppointment(null);
                    fetchWeekAppointments();
                    setToast({ message: 'Appuntamento aggiornato', type: 'success' });
                  }}
                  onCancel={() => setIsEditingAppointment(false)}
                />
              </div>
            ) : (
              <AppointmentDetails
                appointment={selectedAppointment}
                onRefresh={fetchWeekAppointments}
                onEdit={() => setIsEditingAppointment(true)}
                onCancel={() => setShowCancelReason(true)}
                onDelete={handleDeleteAppointment}
                onClose={() => {
                  setSelectedAppointment(null);
                  setShowCancelReason(false);
                  setCancelReason('');
                  setIsEditingAppointment(false);
                }}
              />
            )}
          </Modal>
        )}

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </DndContext>
  );
}
