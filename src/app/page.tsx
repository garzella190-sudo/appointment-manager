'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, ChevronRight, ChevronLeft, Clock, Loader2, User, Calendar as CalendarIconSmall, Search, Car, Phone, StickyNote, Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();
import { Appointment } from '@/types';
import { cn } from '@/lib/utils';
import { format, addDays, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import NewAppointmentModal from '@/components/modals/NewAppointmentModal';
import DetailsModal from '@/components/modals/DetailsModal';
import Select from '@/components/forms/Select';
import { ConfirmBubble } from '@/components/ConfirmBubble';
import { RefreshButton } from '@/components/RefreshButton';

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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
            clienti ( id, nome, cognome, telefono, preferenza_cambio, patente_richiesta_id ),
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

        return {
          id: row.id,
          cliente_id: clienteObj?.id || '',
          appointment_date: format(rowDate, 'yyyy-MM-dd'),
          appointment_time: format(rowDate, 'HH:mm'),
          client_name: clienteObj?.nome === 'UFFICIO' ? clienteObj.cognome : (clienteObj ? `${clienteObj.cognome} ${clienteObj.nome}` : 'Sconosciuto'),
          is_impegno: clienteObj?.nome === 'UFFICIO',
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
          }
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
    fetchAppointments();
  }, [fetchAppointments]);

  // Auto-scroll to nearest appointment on load
  useEffect(() => {
    if (!loading && appointments.length > 0 && isSameDay(currentDate, new Date()) && scrollContainerRef.current) {
      const timer = setTimeout(() => {
        const now = new Date();
        const currentTime = format(now, 'HH:mm');
        
        // Find best appointment to scroll to (the first one >= now, or the last one if all are past)
        const sorted = [...appointments].sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
        const targetApt = sorted.find(a => a.appointment_time >= currentTime) || sorted[sorted.length - 1];
        
        if (targetApt) {
          const element = document.getElementById(`apt-${targetApt.id}`);
          const container = scrollContainerRef.current;
          if (element && container) {
            // Align to top with a small offset (12px) for breathing room
            const scrollPos = element.offsetTop - 12;
            container.scrollTo({ top: scrollPos, behavior: 'smooth' });
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, appointments.length, currentDate]);

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


  const titleText = isSameDay(currentDate, new Date()) ? "Oggi" : format(currentDate, 'EEEE d MMMM', { locale: it });

  return (
    <div className="flex flex-col h-full animate-fade-in overflow-hidden">
      <div className="pt-2 px-4 md:px-6 pb-1 max-w-4xl mx-auto w-full flex-shrink-0">
        <header className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
          <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-none">Agenda</h1>
            <RefreshButton onRefresh={fetchAppointments} className="h-8 w-8 p-0" />
          </div>
            <div className="flex items-center gap-3 mt-0">
              <p className="text-zinc-500 dark:text-zinc-400 capitalize text-sm font-semibold">
                {format(currentDate, 'EEEE d MMMM yyyy', { locale: it })}
              </p>
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50">
                <button
                  onClick={() => navigateDay(-1)}
                  title="Giorno precedente"
                  className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400 appearance-none"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  title="Vai a oggi"
                  className="px-3 py-1 text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider"
                >
                  Oggi
                </button>
                <button
                  onClick={() => navigateDay(1)}
                  title="Giorno successivo"
                  className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400 appearance-none"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 px-4 h-9 rounded-xl text-white font-bold shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 appearance-none text-sm"
          >
            <Plus size={16} />
            <span>Nuovo</span>
          </button>
        </header>

        {/* Search Bar & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Cerca per cliente, istruttore o telefono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-12 pr-4 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm appearance-none shadow-sm"
            />
          </div>
          <div className="min-w-[200px] shrink-0">
            <Select
              options={[
                { id: '', label: 'Tutti gli istruttori' },
                ...istruttori.map(i => ({ 
                  id: i.id, 
                  label: `${i.cognome} ${i.nome}`,
                  color: (i as any).colore 
                }))
              ]}
              value={selectedInstructorId}
              onChange={(val) => setSelectedInstructorId(val)}
              icon={User}
              placeholder="Filtra istruttore"
              searchable
            />
          </div>
        </div>
      </div>

      <section 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scroll-container px-4 md:px-6 pb-32"
      >
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">{titleText}</h2>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{filteredAppointments.length} Appuntamenti</span>
          </div>

          {loading && appointments.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-zinc-400">
              <Loader2 className="animate-spin text-blue-500" size={40} />
              <p className="text-sm font-medium">Caricamento in corso...</p>
            </div>
          ) : filteredAppointments.length > 0 ? (
            <div className="grid gap-3">
              {filteredAppointments.map((apt) => {
                const now = new Date();
                const [h, m] = apt.appointment_time.split(':').map(Number);
                const startTime = new Date(now);
                startTime.setHours(h, m, 0, 0);
                const endTime = new Date(startTime.getTime() + apt.duration * 60000);
                const isInProgress = isSameDay(currentDate, now) && now >= startTime && now < endTime && apt.stato !== 'annullato';

                    const initials = apt.client_name
                      .split(' ')
                      .filter(Boolean)
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);

                return (
                  <div
                    key={apt.id}
                    id={`apt-${apt.id}`}
                    onClick={() => setSelectedAppointment(apt)}
                    className={cn(
                      "group relative p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl cursor-pointer hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all text-left",
                      apt.stato === 'annullato' && "opacity-60 grayscale bg-zinc-50 dark:bg-zinc-950",
                      isInProgress && "ring-[3px] ring-blue-600/40 border-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.2)] dark:shadow-[0_0_15px_rgba(37,99,235,0.1)] animate-pulse-subtle"
                    )}
                  >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div 
                          className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white shadow-inner font-bold text-lg"
                          style={{ backgroundColor: apt.istruttore?.color || '#3b82f6' } as React.CSSProperties}
                        >
                          {initials}
                        </div>
                      <div className="min-w-0">
                        <h3 className={cn(
                          "font-bold text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-2",
                          apt.stato === 'annullato' && "line-through"
                        )}>
                          {apt.client_name}
                          {apt.is_impegno && (
                            <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[8px] font-black rounded-md border border-blue-100/50 dark:border-blue-400/20 uppercase tracking-tighter shrink-0">
                              Impegno
                            </span>
                          )}
                            {apt.notes && apt.notes.trim() !== '' && (
                              <span title={apt.notes} className="text-amber-500 dark:text-amber-400 shrink-0 flex items-center" aria-label="Ha Note">
                                <StickyNote size={14} fill="currentColor" fillOpacity={0.2} />
                              </span>
                            )}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5">
                          <span className="text-xs font-black text-blue-600 dark:text-blue-400">{apt.appointment_time.slice(0, 5)}</span>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                            <User size={12} className="text-zinc-400" />
                            <span className="truncate">{apt.istruttore?.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md text-[10px] font-bold uppercase tracking-wider">
                            <Clock size={10} className="shrink-0" />
                            <span>{apt.duration} min</span>
                          </div>
                          
                          {!apt.is_impegno && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md text-[10px] font-bold uppercase tracking-wider min-w-0">
                              <Car size={10} className="shrink-0" />
                              <span className="truncate max-w-[120px]">{apt.vehicle_id}</span>
                            </div>
                          )}

                          {!apt.is_impegno && (
                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-black uppercase tracking-wider">
                              {apt.license_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {!apt.is_impegno && apt.phone && (
                        <a
                          href={`tel:${apt.phone.replace(/\s/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 transition-colors"
                          title="Chiama cliente"
                        >
                          <Phone size={18} />
                        </a>
                      )}
                      
                      <ConfirmBubble
                        title="Elimina Appuntamento"
                        message="Sei sicuro di voler eliminare questa guida? L'azione è irreversibile."
                        confirmLabel="Elimina"
                        onConfirm={async () => {
                          const { deleteAppointmentAction } = await import('@/actions/appointment_actions');
                          const res = await deleteAppointmentAction(apt.id);
                          if (res.success) {
                            fetchAppointments();
                          } else {
                            alert(res.error || "Errore durante l'eliminazione");
                          }
                        }}
                        trigger={
                          <button
                            className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                            title="Elimina appuntamento"
                          >
                            <Trash2 size={18} />
                          </button>
                        }
                      />

                      <ChevronRight size={20} className="text-zinc-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
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
    </div>
  );
}
