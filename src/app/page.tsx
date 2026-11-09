'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, ChevronRight, ChevronLeft, Clock, Loader2, User, Users, Calendar as CalendarIconSmall, Search, Car, Phone, StickyNote, Trash2, GraduationCap } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();
import { Appointment } from '@/types';
import { cn } from '@/lib/utils';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { isItalianHoliday, isWeekend } from '@/utils/holidays';
import { ConflictsAlert } from '@/components/ConflictsAlert';

import NewAppointmentModal from '@/components/modals/NewAppointmentModal';
import DetailsModal from '@/components/modals/DetailsModal';
import ExamSessionModal from '@/components/modals/ExamSessionModal';
import { OptionPicker } from '@/components/forms/OptionPicker';
import { ConfirmBubble } from '@/components/ConfirmBubble';
import { RefreshButton } from '@/components/RefreshButton';
import DatePickerModal from '@/components/modals/DatePickerModal';
import { useAuth } from '@/hooks/useAuth';
import { leggiIstruttoriSelezionati, salvaIstruttoriSelezionati, sincronizzaModoIstruttori } from '@/lib/preferenzeVista';
import { useHoverApriScheda } from '@/hooks/useHoverApriScheda';
import { useAggiornaAlRitorno } from '@/hooks/useAggiornaAlRitorno';
import { AnteprimaAppuntamento } from '@/components/AnteprimaAppuntamento';

/** Campi necessari alla vista agenda (giorno singolo e ricerca globale). */
const APPOINTMENT_SELECT = `
  id, data, durata, stato, note, importo, istruttore_id, veicolo_id, inizio, fine, sessione_esame_id,
  clienti ( id, nome, cognome, telefono, preferenza_cambio, patente_richiesta_id, sessione_esame_id, pronto_esame ),
  istruttori ( nome, cognome, colore ),
  veicoli ( id, targa, nome, colore )
`;

/** Righe Supabase (relazioni annidate: possono arrivare come oggetto o array). */
type ClienteRiga = {
  id: string; nome: string; cognome: string; telefono: string | null;
  preferenza_cambio: string | null; patente_richiesta_id: string | null;
  sessione_esame_id: string | null; pronto_esame: boolean | null;
};
type IstruttoreRiga = { nome: string; cognome: string; colore: string | null };
type VeicoloRiga = { id: string; targa: string; nome: string; colore: string | null };
type RigaAppuntamento = {
  id: string; data: string; durata: number; stato: string; note: string | null;
  importo: number | null; istruttore_id: string | null; veicolo_id: string | null;
  inizio: string | null; fine: string | null; sessione_esame_id: string | null;
  clienti: ClienteRiga | ClienteRiga[] | null;
  istruttori: IstruttoreRiga | IstruttoreRiga[] | null;
  veicoli: VeicoloRiga | VeicoloRiga[] | null;
};

/** Converte le righe Supabase nel modello usato dalla UI (usato da giorno e ricerca). */
const mapAppointmentRows = (
  rows: RigaAppuntamento[],
  patentiMap: Map<string, string>
): Appointment[] => rows.map((row) => {
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
    exam_status: clienteObj?.sessione_esame_id ? 'scheduled' : (clienteObj?.pronto_esame ? 'ready' : 'none'),
    sessione_esame_id: row.sessione_esame_id
  };
}) as unknown as Appointment[];


/** Targa dal valore `Nome (TARGA)`, altrimenti il nome. Vuoto/Nessuno → null. */
const veicoloBreve = (valore?: string): string | null => {
  const raw = (valore || '').trim();
  if (!raw || raw.toLowerCase() === 'nessuno') return null;
  return raw.match(/\(([^)]+)\)/)?.[1] || raw;
};

/** Durata in minuti → "1h 30m" / "2h" / "45m". Usata per i totali ore della ricerca. */
const formatOre = (minuti: number): string => {
  const tot = Math.max(0, Math.round(minuti || 0));
  const h = Math.floor(tot / 60);
  const m = tot % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

/** Somma delle durate (in minuti) di un elenco di guide. */
const minutiTotali = (lista: Appointment[]): number =>
  lista.reduce((acc, a) => acc + (Number(a.duration) || 0), 0);

/** Linea dell'orario attuale in agenda (una sola per pagina: id per lo scroll automatico). */
const LineaOra = ({ time, withId = false }: { time: string; withId?: boolean }) => (
  <div className="flex items-center gap-2 my-1 -mx-2 px-2 relative" id={withId ? 'current-time-line' : undefined}>
    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] border-2 border-white dark:border-zinc-900 z-10 shrink-0"></div>
    <div className="flex-1 h-[2px] bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] rounded-full"></div>
    <div className="text-[10px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm shrink-0">
      {time}
    </div>
  </div>
);

/**
 * Card di una guida in agenda. Estratta in un componente perché viene usata sia dalla
 * lista a colonna singola sia dalla vista multi-istruttore allineata per orario.
 */
const CardGuida = ({ apt, onOpen, onDelete }: { apt: Appointment; onOpen: () => void; onDelete: () => void }) => {
  // Da PC: mouse fermo 3 secondi sulla card → anteprima rapida che sparisce al movimento
  const [anteprima, setAnteprima] = useState<DOMRect | null>(null);

  const hoverApri = useHoverApriScheda(
    (el) => setAnteprima(el.getBoundingClientRect()),
    { onChiudi: () => setAnteprima(null) }
  );

  const initials = apt.client_name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
    <div
      id={`apt-${apt.id}`}
      onClick={(e) => {
        // Fine di un long-press: mostra solo l'anteprima, non aprire la scheda
        if (hoverApri.consumaClick()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onOpen();
      }}
      onPointerEnter={hoverApri.onPointerEnter}
      onPointerMove={hoverApri.onPointerMove}
      onPointerLeave={hoverApri.onPointerLeave}
      onPointerDown={hoverApri.onPointerDown}
      onTouchStart={hoverApri.onTouchStart}
      onTouchMove={hoverApri.onTouchMove}
      onTouchEnd={hoverApri.onTouchEnd}
      onTouchCancel={hoverApri.onTouchCancel}
      onContextMenu={hoverApri.onContextMenu}
      className={cn(
        "relative border shadow-sm rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 sm:gap-4 group cursor-pointer hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/5 transition-all text-left pr-12 sm:pr-14",
        apt.stato === 'annullato' ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60 grayscale" : "bg-white dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800"
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full">
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-bold text-base sm:text-lg shrink-0 shadow-inner"
          style={{
            backgroundColor: apt.stato === 'annullato' ? '#f4f4f5' : `${apt.istruttore?.color}20` || '#f1f5f9',
            color: apt.stato === 'annullato' ? '#a1a1aa' : apt.istruttore?.color || '#0ea5e9'
          }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className={cn(
            "font-bold flex items-center gap-1.5 sm:gap-2 min-w-0",
            apt.stato === 'annullato' ? "text-zinc-500 dark:text-zinc-400 line-through" : "text-zinc-900 dark:text-white"
          )}>
            <span className={cn(
              "tabular-nums text-xs font-black shrink-0",
              apt.stato === 'annullato' ? "text-zinc-400" : "text-sky-600 dark:text-sky-400"
            )}>{apt.appointment_time}</span>
            <span className="truncate">{apt.client_name}</span>
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
          <div className="flex items-center flex-wrap gap-x-2 sm:gap-x-3 gap-y-1.5 mt-1.5 min-w-0">
            {apt.phone && (
              <a
                href={`tel:${apt.phone.replace(/\D/g, '')}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-tighter hover:underline shrink-0"
              >
                <Phone size={10} />
                {apt.phone}
              </a>
            )}
            <div className="flex items-center gap-1.5 min-w-0 max-w-full text-[10px] text-zinc-500 font-bold uppercase tracking-tight bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md">
              <User size={10} className="text-zinc-400 shrink-0" />
              <span className="truncate">{apt.istruttore?.name}</span>
            </div>
            <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0">
              {apt.duration} min
            </span>
            {apt.license_type && (
              <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0">
                Pat. {apt.license_type}
              </span>
            )}
            {apt.vehicle_id && apt.vehicle_id.trim() !== '' && apt.vehicle_id !== 'Nessuno' && (
              <span
                className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 rounded-md text-[10px] font-black uppercase tracking-wider min-w-0 max-w-full"
                title={apt.vehicle_id}
                style={apt.vehicle_color ? { color: apt.vehicle_color } : undefined}
              >
                <Car size={10} className="shrink-0" />
                <span className="truncate">{apt.vehicle_id}</span>
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
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
        <ConfirmBubble
          title="Elimina Guida"
          message="Sei sicuro di voler eliminare questo appuntamento?"
          confirmLabel="Elimina"
          onConfirm={onDelete}
          trigger={
            <button className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all border border-transparent shadow-sm bg-white dark:bg-zinc-900/80 hover:border-red-200 dark:hover:border-red-900/50">
              <Trash2 size={16} />
            </button>
          }
        />
      </div>
    </div>
    {anteprima && (
      <AnteprimaAppuntamento apt={apt} rect={anteprima} onClose={() => setAnteprima(null)} />
    )}
    </>
  );
};


/** Riga dei risultati di ricerca: mostra sempre DATA, ora, cliente, istruttore, patente e veicolo. */
const RigaRisultato = ({ apt, onOpen }: { apt: Appointment; onOpen: () => void }) => {
  const veicolo = veicoloBreve(apt.vehicle_id);
  const annullata = apt.stato === 'annullato';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full text-left border shadow-sm rounded-2xl p-3 flex items-center justify-between gap-3 transition-all hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/5",
        annullata
          ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60"
          : "bg-white dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800"
      )}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          {format(parseISO(apt.appointment_date), 'EEE d MMM yyyy', { locale: it })} · {apt.appointment_time}
        </p>
        <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{apt.client_name}</p>
        <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 truncate">{apt.istruttore?.name || 'Non assegnato'}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/50">
          PAT. {apt.license_type}
        </span>
        {veicolo && (
          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50 flex items-center gap-1 max-w-[110px]">
            <Car size={9} className="shrink-0" />
            <span className="truncate">{veicolo}</span>
          </span>
        )}
        {annullata && (
          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50">
            Annullata
          </span>
        )}
      </div>
    </button>
  );
};

export default function Home() {
  const { istruttoreId, isIstruttore, loading: authLoading } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const lastScrollY = useRef(0);
  const hasAutoScrolled = useRef(false);
  /** La preferenza salvata è già stata letta (evita di sovrascriverla prima di leggerla). */
  const preferenzaLetta = useRef(false);

  // Ricerca globale: appuntamenti di TUTTO il calendario (non solo il giorno scelto)
  const [globalAppointments, setGlobalAppointments] = useState<Appointment[] | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [searchScope, setSearchScope] = useState<'tutte' | 'future' | 'svolte' | 'annullate'>('tutte');
  
  const [istruttori, setIstruttori] = useState<{ id: string; nome: string; cognome: string }[]>([]);
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>([]);
  const [isInstructorPickerOpen, setIsInstructorPickerOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Popup state
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const fetchAppointments = useCallback(async (opzioni?: { silenzioso?: boolean }) => {
    if (!opzioni?.silenzioso) setLoading(true);
    const dateStr = format(currentDate, 'yyyy-MM-dd');

    try {
      const [{ data: dbData, error: dbError }, { data: patentiData }, { data: istruttoriData }] = await Promise.all([
        supabase
          .from('appuntamenti')
          .select(APPOINTMENT_SELECT)
          .eq('data_solo', dateStr)
          .order('data'),
        supabase.from('patenti').select('id, tipo'),
        supabase.from('istruttori').select('id, nome, cognome').order('cognome')
      ]);

      if (dbError) throw dbError;
      if (istruttoriData) setIstruttori(istruttoriData);

      const patentiMap = new Map<string, string>((patentiData || []).map((p: { id: string; tipo: string }) => [p.id, p.tipo]));

      const mappedAppointments = mapAppointmentRows((dbData || []) as unknown as RigaAppuntamento[], patentiMap);

      setAppointments(mappedAppointments);
      
      if (selectedAppointment) {
        const updated = mappedAppointments.find(a => a.id === selectedAppointment.id);
        if (updated) setSelectedAppointment(updated);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  // Dati freschi ogni volta che l'app PWA torna in primo piano (senza loader a schermo)
  useAggiornaAlRitorno(() => {
    void fetchAppointments({ silenzioso: true });
  });

  useEffect(() => {
    console.log("Agenda V10 - Initialized");
    fetchAppointments();

    const handleUpdate = () => {
      console.log("Sync global triggered: fetching appointments...");
      setGlobalAppointments(null); // invalida la cache della ricerca globale
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

  // Preferenza PERSONALE degli istruttori: condivisa con il Calendario e mai resettata.
  // - se l'utente ha già scelto qualcosa, si riusa quella scelta;
  // - al primo avvio si parte dal proprio calendario (se l'account è collegato a un istruttore);
  // - da quel momento la scelta si salva a ogni modifica manuale e non viene più toccata.
  useEffect(() => {
    if (authLoading || preferenzaLetta.current) return;
    const salvati = leggiIstruttoriSelezionati();
    if (salvati) {
      setSelectedInstructorIds(salvati);
    } else if (istruttoreId) {
      setSelectedInstructorIds([istruttoreId]);
    }
    preferenzaLetta.current = true;
  }, [authLoading, istruttoreId]);

  // Salvataggio della scelta manuale (vale anche per il Calendario)
  useEffect(() => {
    if (!preferenzaLetta.current) return;
    salvaIstruttoriSelezionati(selectedInstructorIds);
    sincronizzaModoIstruttori(selectedInstructorIds);
  }, [selectedInstructorIds]);

  // Ricerca globale: cerca la parola in TUTTO il calendario, non solo nel giorno scelto.
  // Il fetch completo (una volta sola, poi in cache) viene invalidato al sync degli appuntamenti.
  const isGlobalSearch = searchQuery.trim().length >= 2;

  useEffect(() => {
    if (!isGlobalSearch || globalAppointments) return;
    let annullato = false;

    (async () => {
      setGlobalLoading(true);
      try {
        const { data: patentiData } = await supabase.from('patenti').select('id, tipo');

        // Supabase/PostgREST restituisce al massimo 1000 righe per richiesta:
        // senza paginazione le guide più recenti non entrerebbero mai nei risultati.
        const PAGINA = 1000;
        const righe: RigaAppuntamento[] = [];
        for (let da = 0; da < 20000; da += PAGINA) {
          const { data: pagina, error: paginaError } = await supabase
            .from('appuntamenti')
            .select(APPOINTMENT_SELECT)
            .order('data')
            .range(da, da + PAGINA - 1);
          if (paginaError) throw paginaError;
          const blocco = (pagina || []) as unknown as RigaAppuntamento[];
          righe.push(...blocco);
          if (blocco.length < PAGINA) break;
        }

        const patentiMap = new Map<string, string>((patentiData || []).map((p: { id: string; tipo: string }) => [p.id, p.tipo]));
        if (!annullato) setGlobalAppointments(mapAppointmentRows(righe, patentiMap));
      } catch (err) {
        console.error('Error fetching all appointments:', err);
      } finally {
        if (!annullato) setGlobalLoading(false);
      }
    })();

    return () => { annullato = true; };
  }, [isGlobalSearch, globalAppointments]);

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

    if (selectedInstructorIds.length > 0) {
      result = result.filter(a => selectedInstructorIds.includes(a.trainer_id));
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
  }, [appointments, searchQuery, selectedInstructorIds]);

  // Guide raggruppate per istruttore, ognuna in ordine cronologico
  const gruppiIstruttori = useMemo(() => {
    const mappa = new Map<string, { id: string; nome: string; colore?: string; items: Appointment[] }>();

    for (const apt of filteredAppointments) {
      const chiave = apt.trainer_id || 'non-assegnato';
      if (!mappa.has(chiave)) {
        mappa.set(chiave, {
          id: chiave,
          nome: apt.istruttore?.name?.trim() || 'Non assegnato',
          colore: apt.istruttore?.color,
          items: [],
        });
      }
      mappa.get(chiave)!.items.push(apt);
    }

    const gruppi = [...mappa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    gruppi.forEach(g => g.items.sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)));
    return gruppi;
  }, [filteredAppointments]);

  /** Con più di un istruttore si usa la vista a colonne allineate per orario. */
  const vistaMulti = gruppiIstruttori.length > 1;

  /**
   * Timeline dell'agenda per la vista multi-istruttore.
   *
   * Si costruisce la mappa `ora → istruttore → guide`: così la stessa ora finisce sulla
   * stessa riga della griglia in TUTTE le colonne (gli appuntamenti restano allineati per
   * orario anche scorrendo in orizzontale su desktop e tablet).
   */
  const timelineAgenda = useMemo(() => {
    const celle = new Map<string, Map<string, Appointment[]>>();

    for (const apt of filteredAppointments) {
      const ora = apt.appointment_time;
      if (!celle.has(ora)) celle.set(ora, new Map());
      const perGruppo = celle.get(ora)!;
      const chiave = apt.trainer_id || 'non-assegnato';
      if (!perGruppo.has(chiave)) perGruppo.set(chiave, []);
      perGruppo.get(chiave)!.push(apt);
    }

    const orari = [...celle.keys()].sort();
    const adesso = format(new Date(), 'HH:mm');
    const righe: Array<{ tipo: 'orario'; ora: string } | { tipo: 'adesso' }> = [];

    if (isSameDay(currentDate, new Date())) {
      let inserita = false;
      for (const ora of orari) {
        if (!inserita && ora > adesso) {
          righe.push({ tipo: 'adesso' });
          inserita = true;
        }
        righe.push({ tipo: 'orario', ora });
      }
      if (!inserita) righe.push({ tipo: 'adesso' });
    } else {
      for (const ora of orari) righe.push({ tipo: 'orario', ora });
    }

    return { celle, righe, adesso };
  }, [filteredAppointments, currentDate]);

  /** Eliminazione guida (la card è un componente condiviso, quindi il server action arriva da qui). */
  const eliminaGuida = async (id: string) => {
    const { deleteAppointmentAction } = await import('@/actions/appointment_actions');
    await deleteAppointmentAction(id);
    fetchAppointments();
  };

  /**
   * Risultati della ricerca globale (tutto il calendario), separati in guide FUTURE, SVOLTE e ANNULLATE.
   * Il filtro istruttore NON si applica: si cerca il cliente, chiunque lo segua.
   * Le guide annullate hanno una sezione propria: non sono né "future" né "svolte" e non
   * devono sparire dentro gli altri gruppi.
   */
  const risultatiRicerca = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const vuoto = { future: [], svolte: [], annullate: [], totale: 0, ore: { tutte: 0, future: 0, svolte: 0, annullate: 0 } };
    if (!isGlobalSearch || !globalAppointments) return vuoto;

    const trovati = globalAppointments.filter(a =>
      (a.client_name?.toLowerCase().includes(q)) ||
      (a.istruttore?.name?.toLowerCase().includes(q)) ||
      (a.phone && a.phone.includes(q))
    );

    const adesso = format(new Date(), 'yyyy-MM-dd HH:mm');
    const chiave = (a: Appointment) => `${a.appointment_date} ${a.appointment_time}`;
    const annullata = (a: Appointment) => a.stato === 'annullato';

    const attive = trovati.filter(a => !annullata(a));
    const future = attive.filter(a => chiave(a) >= adesso).sort((a, b) => chiave(a).localeCompare(chiave(b)));
    const svolte = attive.filter(a => chiave(a) < adesso).sort((a, b) => chiave(b).localeCompare(chiave(a)));
    const annullate = trovati.filter(annullata).sort((a, b) => chiave(b).localeCompare(chiave(a)));

    return {
      future,
      svolte,
      annullate,
      totale: trovati.length,
      // Ore (in minuti): tutte = totale, effettuate = svolte, annullate = annullate
      ore: {
        tutte: minutiTotali(trovati),
        future: minutiTotali(future),
        svolte: minutiTotali(svolte),
        annullate: minutiTotali(annullate),
      },
    };
  }, [isGlobalSearch, globalAppointments, searchQuery]);

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
    }
    lastScrollY.current = currentY;
  };

  const titleText = isSameDay(currentDate, new Date()) ? "Oggi" : format(currentDate, 'EEEE d MMMM', { locale: it });

  return (
    <div className="flex flex-col h-full animate-fade-in overflow-hidden">
      <div className="pt-2 px-4 md:px-6 pb-1 max-w-2xl mx-auto w-full flex-shrink-0">
        <header className="relative mb-2 flex flex-col gap-2 lg:gap-0">
          {/* Riga 1 — Titolo, data e azioni rapide */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0 lg:max-w-[236px]">
              <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-none truncate">
                  Agenda
                </h1>
                <span className="text-[10px] font-black bg-sky-100 dark:bg-sky-900 text-sky-600 px-1.5 py-0.5 rounded-md tracking-tighter shrink-0">
                  V10
                </span>
                <RefreshButton onRefresh={fetchAppointments} className="h-9 w-9 sm:h-8 sm:w-8 p-0 shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0 mt-1">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(true)}
                  title="Tocca per scegliere una data"
                  className="flex items-center min-w-0 text-left active:opacity-50 transition-opacity"
                >
                  <span className="block min-w-0 truncate text-zinc-600 dark:text-zinc-300 capitalize text-base sm:text-lg font-bold tracking-tight leading-none">
                    <span className="sm:hidden">{format(currentDate, 'EEE d MMM yyyy', { locale: it })}</span>
                    <span className="hidden sm:inline lg:hidden">{format(currentDate, 'EEEE d MMMM yyyy', { locale: it })}</span>
                    <span className="hidden lg:inline">
                      {format(
                        currentDate,
                        currentDate.getFullYear() === new Date().getFullYear() ? 'EEEE d MMMM' : 'EEEE d MMMM yyyy',
                        { locale: it }
                      )}
                    </span>
                  </span>
                </button>
                {appointments.some(a =>
                  a.is_impegno &&
                  a.tipo_impegno?.toUpperCase().includes('ESAME')
                ) && (
                  <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-amber-400 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm shadow-amber-400/30 shrink-0">
                    🎓 Esame
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                onClick={() => { setShowSearch(!showSearch); }}
                title="Cerca appuntamento"
                className={cn("h-9 w-9 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0", showSearch ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-inner" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-sky-600")}
              >
                <Search size={16} />
              </button>
              <button
                onClick={() => { setIsInstructorPickerOpen(true); setShowSearch(false); }}
                title="Scegli gli istruttori da visualizzare"
                className={cn("relative h-9 w-9 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0", selectedInstructorIds.length > 0 ? "bg-sky-100 dark:bg-sky-900 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-sky-600")}
              >
                <Users size={16} />
                {selectedInstructorIds.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-sky-500 text-white text-[9px] font-black flex items-center justify-center leading-none">
                    {selectedInstructorIds.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-sky-500 px-2.5 sm:px-4 h-9 rounded-xl text-white font-black shadow-lg shadow-sky-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-[11px] uppercase tracking-wider shrink-0"
              >
                <Plus size={16} className="shrink-0" />
                <span className="hidden sm:inline">Nuovo</span>
              </button>
            </div>
          </div>

          {/* Riga 2 — Oggi + datepicker: stesso gruppo, stesse misure e stessa posizione del Calendario */}
          <div className="flex items-center justify-center w-full lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:pointer-events-none">
            <div className="flex items-center shrink-0 h-11 sm:h-10 gap-0.5 sm:gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-0.5 sm:p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-inner pointer-events-auto">
              <button
                onClick={(e) => { e.preventDefault(); navigateDay(-1); }}
                title="Giorno precedente"
                className="h-9 w-8 sm:h-8 sm:w-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); setCurrentDate(new Date()); }}
                title="Vai a oggi"
                className="px-1.5 sm:px-3 h-9 sm:h-8 text-[10px] sm:text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider hover:text-sky-600 transition-all flex items-center whitespace-nowrap"
              >
                Oggi
              </button>
              <button
                onClick={(e) => { e.preventDefault(); navigateDay(1); }}
                title="Giorno successivo"
                className="h-9 w-8 sm:h-8 sm:w-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 dark:text-zinc-400"
              >
                <ChevronRight size={18} />
              </button>

              <div className="hidden sm:block w-[1px] h-5 bg-zinc-200 dark:bg-zinc-700/50 mx-0.5"></div>

              <button
                onClick={() => setIsDatePickerOpen(true)}
                className="h-9 w-8 sm:h-8 sm:w-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-600 hover:text-sky-600 dark:text-zinc-400 focus:outline-none cursor-pointer"
                title="Scegli una data"
              >
                <CalendarIconSmall size={18} />
              </button>
            </div>
          </div>
        </header>

        <div className={cn(
          "transition-all duration-300 ease-in-out origin-top",
          showSearch ? "max-h-[400px] opacity-100 mb-3 overflow-visible" : "max-h-0 opacity-0 mb-0 overflow-hidden"
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
        </div>
      </div>

      <section 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-container px-4 md:px-6 pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className={cn("mx-auto space-y-3", isGlobalSearch ? "max-w-4xl" : "max-w-2xl")}>
          <div className="flex items-center justify-between px-1 gap-2">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight truncate">
              {isGlobalSearch ? `Ricerca: ${searchQuery.trim()}` : titleText}
            </h2>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest shrink-0">
              {isGlobalSearch ? `${risultatiRicerca.totale} Risultati` : `${filteredAppointments.length} Guide`}
            </span>
          </div>

          {isGlobalSearch ? (
            /* ---------- RICERCA GLOBALE (tutto il calendario: future, svolte e annullate) ---------- */
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:flex gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
                {([
                  ['tutte', 'Tutte', risultatiRicerca.totale],
                  ['future', 'Future', risultatiRicerca.future.length],
                  ['svolte', 'Svolte', risultatiRicerca.svolte.length],
                  ['annullate', 'Annullate', risultatiRicerca.annullate.length],
                ] as const).map(([valore, etichetta, quante]) => (
                  <button
                    key={valore}
                    type="button"
                    onClick={() => setSearchScope(valore)}
                    className={cn(
                      // Niente ore sui tasti: su mobile li rendevano meno leggibili.
                      // Le ore restano nel riepilogo qui sotto e nelle intestazioni delle sezioni.
                      "flex-1 h-9 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all px-1 whitespace-nowrap",
                      searchScope === valore
                        ? valore === 'annullate'
                          ? "bg-white dark:bg-zinc-800 text-red-600 dark:text-red-400 shadow-sm"
                          : "bg-white dark:bg-zinc-800 text-sky-600 dark:text-sky-400 shadow-sm"
                        : valore === 'annullate'
                          ? "text-red-400/70"
                          : "text-zinc-400"
                    )}
                  >
                    {etichetta} {quante}
                  </button>
                ))}
              </div>

              {/* Riepilogo ore: totale / effettuate / annullate */}
              {risultatiRicerca.totale > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['Ore totali', risultatiRicerca.ore.tutte, 'text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50'],
                    ['Effettuate', risultatiRicerca.ore.svolte, 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20'],
                    ['Annullate', risultatiRicerca.ore.annullate, 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20'],
                  ] as const).map(([label, minuti, classi]) => (
                    <div key={label} className={cn("rounded-xl border px-3 py-2 text-center", classi)}>
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{label}</p>
                      <p className="text-sm font-black tabular-nums">{formatOre(minuti)}</p>
                    </div>
                  ))}
                </div>
              )}

              {globalLoading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-4 text-zinc-400">
                  <Loader2 className="animate-spin text-sky-500" size={36} />
                  <p className="text-sm font-medium">Cerco in tutto il calendario...</p>
                </div>
              ) : risultatiRicerca.totale === 0 ? (
                <div className="p-10 text-center bg-zinc-50 dark:bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <p className="text-zinc-900 dark:text-zinc-100 font-bold">Nessuna guida trovata</p>
                  <p className="text-zinc-500 text-sm mt-1">Nessun appuntamento per “{searchQuery.trim()}” in tutto il calendario.</p>
                </div>
              ) : (
                <>
                  {(searchScope === 'tutte' || searchScope === 'future') && risultatiRicerca.future.length > 0 && (
                    <section className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Guide future</h3>
                        <span className="text-[10px] font-bold text-zinc-400 shrink-0">{risultatiRicerca.future.length} · {formatOre(risultatiRicerca.ore.future)}</span>
                        <div className="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {risultatiRicerca.future.map(apt => (
                          <RigaRisultato key={apt.id} apt={apt} onOpen={() => setSelectedAppointment(apt)} />
                        ))}
                      </div>
                    </section>
                  )}

                  {(searchScope === 'tutte' || searchScope === 'svolte') && risultatiRicerca.svolte.length > 0 && (
                    <section className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 shrink-0" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Guide svolte</h3>
                        <span className="text-[10px] font-bold text-zinc-400 shrink-0">{risultatiRicerca.svolte.length} · {formatOre(risultatiRicerca.ore.svolte)}</span>
                        <div className="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {risultatiRicerca.svolte.map(apt => (
                          <RigaRisultato key={apt.id} apt={apt} onOpen={() => setSelectedAppointment(apt)} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Guide ANNULLATE: sezione dedicata, sempre in fondo e con il tasto rosso */}
                  {(searchScope === 'tutte' || searchScope === 'annullate') && risultatiRicerca.annullate.length > 0 && (
                    <section className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-red-500 dark:text-red-400">Guide annullate</h3>
                        <span className="text-[10px] font-bold text-red-400 shrink-0">{risultatiRicerca.annullate.length} · {formatOre(risultatiRicerca.ore.annullate)}</span>
                        <div className="flex-1 h-[1px] bg-red-200 dark:bg-red-900/50" />
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {risultatiRicerca.annullate.map(apt => (
                          <RigaRisultato key={apt.id} apt={apt} onOpen={() => setSelectedAppointment(apt)} />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          ) : loading && appointments.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-zinc-400">
              <Loader2 className="animate-spin text-sky-500" size={40} />
              <p className="text-sm font-medium">Sincronizzazione...</p>
            </div>
          ) : filteredAppointments.length > 0 ? (
            vistaMulti ? (
              /* ---------- MULTI-ISTRUTTORE: colonne affiancate con le RIGHE ALLINEATE PER ORARIO ---------- */
              <div
                className="scroll-x-visible pb-3 snap-x snap-mandatory"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div
                  className="grid gap-x-3 gap-y-2 items-start"
                  style={{ gridTemplateColumns: `repeat(${gruppiIstruttori.length}, min(86vw, 320px))` }}
                >
                  {/* Intestazioni: un istruttore per colonna */}
                  {gruppiIstruttori.map(gruppo => (
                    <div key={`head-${gruppo.id}`} className="flex items-center gap-2 px-1 snap-start">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: gruppo.colore || '#0ea5e9' }}
                      />
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 truncate">
                        {gruppo.nome}
                      </h3>
                      <span className="text-[10px] font-bold text-zinc-400 shrink-0">{gruppo.items.length}</span>
                      <div className="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  ))}

                  {/* Righe: una per orario, così le guide della stessa ora sono allineate */}
                  {timelineAgenda.righe.map((riga, idx) => (
                    riga.tipo === 'adesso' ? (
                      <div key={`adesso-${idx}`} className="col-span-full">
                        <LineaOra time={timelineAgenda.adesso} withId />
                      </div>
                    ) : (
                      <React.Fragment key={`riga-${riga.ora}`}>
                        {gruppiIstruttori.map(gruppo => {
                          const items = timelineAgenda.celle.get(riga.ora)?.get(gruppo.id) || [];
                          return (
                            <div key={`${riga.ora}-${gruppo.id}`} className="min-w-0 space-y-2">
                              {items.map(apt => (
                                <CardGuida
                                  key={apt.id}
                                  apt={apt}
                                  onOpen={() => setSelectedAppointment(apt)}
                                  onDelete={() => eliminaGuida(apt.id)}
                                />
                              ))}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    )
                  ))}
                </div>
              </div>
            ) : (
              /* ---------- COLONNA SINGOLA ---------- */
              <div className="space-y-5">
                {gruppiIstruttori.map((gruppo, groupIdx) => (
                  <div key={gruppo.id} className="space-y-2">
                    {/* Intestazione istruttore */}
                    <div className="flex items-center gap-2 px-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: gruppo.colore || '#0ea5e9' }}
                      />
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 truncate">
                        {gruppo.nome}
                      </h3>
                      <span className="text-[10px] font-bold text-zinc-400 shrink-0">{gruppo.items.length}</span>
                      <div className="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800" />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {gruppo.items.map((apt, index) => {
                        const now = new Date();
                        const isToday = isSameDay(currentDate, now);
                        const currentTimeStr = format(now, 'HH:mm');
                        const nextApt = gruppo.items[index + 1];

                        let insertLineBefore = false;
                        let insertLineAfter = false;

                        if (isToday) {
                          if (index === 0 && apt.appointment_time > currentTimeStr) {
                            insertLineBefore = true;
                          } else if (apt.appointment_time <= currentTimeStr && (!nextApt || nextApt.appointment_time > currentTimeStr)) {
                            insertLineAfter = true;
                          }
                        }

                        return (
                          <React.Fragment key={apt.id}>
                            {insertLineBefore && <LineaOra time={currentTimeStr} withId={groupIdx === 0} />}
                            <CardGuida
                              apt={apt}
                              onOpen={() => setSelectedAppointment(apt)}
                              onDelete={() => eliminaGuida(apt.id)}
                            />
                            {insertLineAfter && <LineaOra time={currentTimeStr} withId={groupIdx === 0} />}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
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
        selectedAppointment.sessione_esame_id ? (
          <ExamSessionModal
            isOpen={true}
            onClose={() => setSelectedAppointment(null)}
            onSuccess={fetchAppointments}
            sessionId={selectedAppointment.sessione_esame_id}
          />
        ) : (
          <DetailsModal
            isOpen={true}
            onClose={() => setSelectedAppointment(null)}
            onSuccess={fetchAppointments}
            appointmentId={selectedAppointment.id}
          />
        )
      )}

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedDate={currentDate}
        onSelect={(date) => setCurrentDate(date)}
      />

      {/* Selettore istruttori (multi) — aperto dal tasto people */}
      <OptionPicker
        options={[...istruttori]
          .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'))
          .map(i => ({ id: i.id, label: `${i.cognome} ${i.nome}`.trim() }))}
        title="Istruttori"
        searchPlaceholder="Cerca istruttore..."
        icon={<Users size={18} className="text-purple-500" />}
        multiple
        selectedValues={selectedInstructorIds}
        onToggle={(id) => setSelectedInstructorIds(prev =>
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )}
        isOpen={isInstructorPickerOpen}
        onOpenChange={setIsInstructorPickerOpen}
        hideTrigger
        confirmLabel="Conferma"
      />
    </div>
  );
}
