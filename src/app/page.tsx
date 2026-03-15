'use client';

import React, { useEffect, useState } from 'react';
import { Plus, ChevronRight, ChevronLeft, Clock, Loader2, User, Car, FileText, Phone, Calendar as CalendarIconSmall } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/types';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/Modal';
import { AppointmentForm } from '@/components/forms/AppointmentForm';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { AppointmentDetails } from '@/components/calendar/AppointmentDetails';

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Popup state
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isEditingAppointment, setIsEditingAppointment] = useState(false);

  const fetchAppointments = async () => {
    setLoading(true);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const startOfDayStr = new Date(`${dateStr}T00:00:00`).toISOString();
    const endOfDayStr = new Date(`${dateStr}T23:59:59`).toISOString();

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
          .gte('data', startOfDayStr)
          .lte('data', endOfDayStr)
          .order('data'),
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
          stato: row.stato, // Mantengo entrambi per compatibilità
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
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAppointments();
  }, [currentDate]);

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchAppointments();
  };

  const navigateDay = (direction: number) => {
    setCurrentDate(prev => addDays(prev, direction));
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;
    if (window.confirm('Sei sicuro di voler eliminare questo appuntamento?')) {
      const { error } = await supabase
        .from('appuntamenti')
        .delete()
        .eq('id', selectedAppointment.id);

      if (!error) {
        setSelectedAppointment(null);
        fetchAppointments();
      } else {
        alert('Errore durante l\'eliminazione');
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
      fetchAppointments();
    } else {
      alert('Errore durante l\'annullamento');
    }
  };

  const titleText = isSameDay(currentDate, new Date()) ? "Oggi" : format(currentDate, 'EEEE d MMMM', { locale: it });

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Agenda</h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-zinc-500 dark:text-zinc-400 capitalize text-lg font-medium">
              {format(currentDate, 'EEEE d MMMM yyyy', { locale: it })}
            </p>
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl shadow-inner">
              <button
                onClick={() => navigateDay(-1)}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-xs font-bold text-zinc-900 dark:text-zinc-100"
              >
                Oggi
              </button>
              <button
                onClick={() => navigateDay(1)}
                className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all focus:ring-4 focus:ring-blue-500/20"
        >
          <Plus size={24} />
        </button>
      </header>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold px-1 capitalize">{titleText}</h2>

        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-zinc-400">
            <Loader2 className="animate-spin" size={40} />
            <p>Caricamento appuntamenti...</p>
          </div>
        ) : appointments.length > 0 ? (
          <div className="grid gap-4">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                onClick={() => setSelectedAppointment(apt)}
                className={cn(
                  "glass-card p-5 group cursor-pointer hover:border-blue-500/50 transition-all",
                  (apt as any).stato === 'annullato' ? "opacity-60 grayscale" : ""
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-inner",
                      apt.is_unavailability ? "bg-zinc-400" : "bg-blue-500"
                    )} style={apt.trainers?.color ? { backgroundColor: apt.trainers?.color } : {}}>
                      <Clock size={20} />
                    </div>
                    <div>
                      <h3 className={cn("font-bold text-lg", (apt as any).stato === 'annullato' && "line-through")}>
                        {apt.client_name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <span className="font-bold text-zinc-900 dark:text-zinc-300">{apt.appointment_time.slice(0, 5)}</span>
                        <span>•</span>
                        <span>{apt.trainers?.name || 'Istruttore'}</span>
                        <span>•</span>
                        <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                          {apt.license_type}
                        </span>
                        {(apt as any).stato === 'annullato' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            Annullato
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-zinc-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-10 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
            <CalendarIconSmall size={32} className="opacity-50" />
            <p>Nessun appuntamento in questa data.</p>
          </div>
        )}
      </section>

      {/* Modal Nuovo Appuntamento */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nuovo Appuntamento"
      >
        <AppointmentForm onSuccess={handleSuccess} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      {/* Modal Dettaglio Appuntamento (Copiato dal Calendar) */}
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
                  fetchAppointments();
                  // alert or toast usually missing here since toast isn't in page.tsx yet
                }}
                onCancel={() => setIsEditingAppointment(false)}
              />
            </div>
          ) : (
            <AppointmentDetails
              appointment={selectedAppointment}
              onRefresh={fetchAppointments}
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
    </div>
  );
}
