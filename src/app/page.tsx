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
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: selectedAppointment.trainers?.color || '#3b82f6' }}
              >
                <User size={24} />
              </div>
              <div>
                <h3 className={cn("text-lg font-black text-zinc-900 dark:text-zinc-50", (selectedAppointment as any).stato === 'annullato' && "line-through opacity-70")}>
                  {selectedAppointment.client_name}
                </h3>
                <p className="text-sm text-zinc-500 flex items-center gap-1">
                  <Phone size={14} /> {selectedAppointment.phone || 'Nessun numero'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] uppercase font-bold text-zinc-400 mb-1 flex items-center gap-1">
                  <CalendarIconSmall size={12} /> Data e Ora
                </p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {format(parseISO(selectedAppointment.appointment_date), 'dd MMMM yyyy', { locale: it })}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-black mt-0.5">
                  {selectedAppointment.appointment_time.slice(0, 5)} ({selectedAppointment.duration} min)
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] uppercase font-bold text-zinc-400 mb-1 flex items-center gap-1">
                  <Car size={12} /> Veicolo e Patente
                </p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedAppointment.license_type} - {selectedAppointment.gearbox_type}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                  {selectedAppointment.vehicle_id}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
              <p className="text-[10px] uppercase font-bold text-zinc-400 mb-2 flex items-center gap-1">
                <FileText size={12} /> Note
              </p>
              <p className="text-sm italic text-zinc-600 dark:text-zinc-400">
                {selectedAppointment.notes || 'Nessuna nota aggiuntiva.'}
              </p>
            </div>

            <div className="flex gap-3 pt-2 mt-4">
              {!showCancelReason ? (
                <>
                  <button
                    onClick={() => setIsEditingAppointment(true)}
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 font-bold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all text-sm focus:ring-4 focus:ring-blue-500/20"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => setShowCancelReason(true)}
                    disabled={(selectedAppointment as any).stato === 'annullato'}
                    className="flex-1 py-3 px-4 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 font-bold hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:ring-4 focus:ring-orange-500/20"
                  >
                    Annulla Guida
                  </button>
                  <button
                    onClick={handleDeleteAppointment}
                    className="flex-1 py-3 px-4 rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-all text-sm focus:ring-4 focus:ring-red-500/20"
                  >
                    Elimina
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAppointment(null);
                      setShowCancelReason(false);
                      setCancelReason('');
                    }}
                    className="flex-[0.5] py-3 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg text-sm"
                  >
                    Chiudi
                  </button>
                </>
              ) : (
                <div className="w-full space-y-4">
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Motivo dell'annullamento (opzionale)..."
                    className="w-full p-3 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-red-500/20 outline-none resize-none"
                    rows={3}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCancelReason(false)}
                      className="flex-1 py-3 px-4 rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-sm"
                    >
                      Indietro
                    </button>
                    <button
                      onClick={handleConfirmCancel}
                      className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 text-sm"
                    >
                      Conferma Annullamento
                    </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
