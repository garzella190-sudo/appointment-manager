'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();
import { Veicolo, Patente, TipoPatente, ImpegnoDettagliato } from '@/lib/database.types';
import { Modal } from '@/components/Modal';
import { VeicoloForm } from '@/components/forms/VeicoloForm';
import { IstruttoreForm } from '@/components/forms/IstruttoreForm';
import { ImpegnoForm } from '@/components/forms/ImpegnoForm';
import { AppointmentForm } from '@/components/forms/AppointmentForm';
import { UserForm } from '@/components/forms/UserForm';
import { PatenteForm } from '@/components/forms/PatenteForm';
import { InstallPWA } from '@/components/InstallPWA';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { listUsersAction, updateUserAction } from '@/actions/auth';
import { deleteVeicoloAction } from '@/actions/veicoli';
import { deleteIstruttoreAction } from '@/actions/istruttori';
import { deleteAppointmentAction, cancelAppointmentAction } from '@/actions/appointment_actions';
import { useRevisionReminder } from '@/hooks/useRevisionReminder';
import {
  AlertTriangle, CheckCircle2, Phone, Mail, Search,
  Clock, EyeOff, Eye, Copy,
  Car, BadgeCheck, Users, Plus, Pencil, Loader2, ShieldCheck, Key, User as UserIcon, Trash2, Smartphone, X, ChevronRight, Wrench
} from 'lucide-react';
import Select from '@/components/forms/Select';
import { cn } from '@/lib/utils';
import { User as AuthUser } from '@supabase/supabase-js';
import { PhoneActions } from '@/components/PhoneActions';
import { ConfirmBubble } from '@/components/ConfirmBubble';
import { RefreshButton } from '@/components/RefreshButton';
import { useAuth } from '@/hooks/useAuth';
import { FileText, Printer, ChevronDown } from 'lucide-react';

// ── Stili per la stampa ────────────────────────────────────────
const PrintStyles = () => (
  <style jsx global>{`
    @media print {
      body { background: white !important; }
      .print-hidden { display: none !important; }
      .print-only { display: block !important; }
      .scroll-container { overflow: visible !important; height: auto !important; }
      .no-shadow { shadow: none !important; box-shadow: none !important; }
      .no-border { border: none !important; }
      @page { margin: 1.5cm; }
    }
    .print-only { display: none; }
  `}</style>
);

// ── Helper per badge scadenza revisione ───────────────────────
const RevisionBadge = ({ dataRevisione }: { dataRevisione: string }) => {
  const { isExpired, isNearExpiry, daysLeft } = useRevisionReminder(dataRevisione);
  if (daysLeft === null) return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold',
      isExpired ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
        isNearExpiry ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
          'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
    )}>
      {isExpired ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
      {isExpired
        ? `Scaduta ${Math.abs(daysLeft)}gg fa`
        : isNearExpiry
          ? `${daysLeft}gg`
          : new Date(dataRevisione).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
      }
    </span>
  );
};

// ── Tab: Veicoli ──────────────────────────────────────────────
const TabVeicoli = ({ refreshKey, sectionColor, isAdmin }: { refreshKey: number, sectionColor: string, isAdmin: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Veicolo | null>(null);

  const fetchVeicoli = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('veicoli').select('*').order('nome');
    setVeicoli(data ?? []);
    setLoading(false);
  }, []);

  // handleDelete removed, logic moved to ConfirmBubble onConfirm

  useEffect(() => { fetchVeicoli(); }, [fetchVeicoli, refreshKey]);

  const openEdit = (v: Veicolo) => { setEditing(v); setModalOpen(true); };
  const onSuccess = () => { setModalOpen(false); fetchVeicoli(); };

  const filtered = veicoli.filter(v => 
    v.nome.toLowerCase().includes(search.toLowerCase()) || 
    v.targa.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="pb-4 flex-shrink-0">
        <div className="relative group">
          <Search
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors",
              sectionColor === 'emerald' ? "group-focus-within:text-emerald-500" : "group-focus-within:text-sky-500"
            )}
            size={20}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o targa..."
            className={cn(
              "w-full h-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 outline-none transition-all shadow-sm text-sm",
              sectionColor === 'emerald' ? "focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500" : "focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500"
            )}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-container pb-8">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-zinc-400">
            <Loader2 className={cn("animate-spin", sectionColor === 'emerald' ? "text-emerald-500" : "text-sky-500")} size={40} />
            <p className="text-sm font-medium">Caricamento...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-16 text-center shadow-sm">
            <Car size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-400">
              {search ? 'Nessun veicolo trovato.' : 'Nessun veicolo registrato.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(v => {
              const initials = v.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              return (
                <div 
                  key={v.id}
                  onClick={() => openEdit(v)}
                  className="relative bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl p-4 flex items-center justify-between gap-4 group cursor-pointer hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all pr-12"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1 w-full sm:w-auto">
                    <div 
                      className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xl shadow-inner border border-emerald-200/50 dark:border-emerald-500/10"
                    >
                      {initials || <Car size={20} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-zinc-900 dark:text-white truncate">
                          {v.nome}
                        </h4>
                        <span className="font-mono text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded tracking-widest leading-none border border-zinc-200/50 dark:border-zinc-700">
                          {v.targa}
                        </span>
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-1.5 overflow-hidden">
                        <span className="px-1.5 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-md text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                          Pat. {v.tipo_patente}
                        </span>
                        <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                          {v.cambio_manuale ? 'Manuale' : 'Automatico'}
                        </span>
                        <RevisionBadge dataRevisione={v.data_revisione} />
                      </div>
                    </div>
                  </div>

                  <div className="absolute top-3 right-3 z-10 flex gap-2">
                      <ConfirmBubble
                        title="Elimina Veicolo"
                        message="Sei sicuro di voler eliminare questo veicolo? L'azione è definitiva."
                        confirmLabel="Elimina"
                        onConfirm={async () => {
                          const result = await deleteVeicoloAction(v.id);
                          if (result.success) {
                            fetchVeicoli();
                          } else {
                            alert(result.error || "Errore durante l'eliminazione.");
                          }
                        }}
                        trigger={
                          <button
                            className={cn(
                              "p-1.5 rounded-lg text-zinc-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all border border-transparent shadow-sm bg-white dark:bg-zinc-900/80 hover:border-red-200 dark:hover:border-red-900/50",
                              !isAdmin && "hidden"
                            )}
                            title="Elimina veicolo"
                          >
                            <Trash2 size={16} />
                          </button>
                        }
                      />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Dettagli Veicolo' : 'Nuovo Veicolo'}
      >
        <VeicoloForm
          key={editing?.id || 'new'}
          veicoloId={editing?.id}
          initialMode={editing ? 'view' : 'edit'}
          defaultValues={editing ? {
            nome: editing.nome,
            targa: editing.targa,
            data_revisione: editing.data_revisione,
            tipo_patente: editing.tipo_patente,
            cambio_manuale: editing.cambio_manuale,
            colore: editing.colore,
          } : undefined}
          onSuccess={onSuccess}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

// ── Tab: Istruttori ───────────────────────────────────────────
const TabIstruttori = ({ refreshKey, sectionColor, isAdmin }: { refreshKey: number, sectionColor: string, isAdmin: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [istruttori, setIstruttori] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Veicolo[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [{ data: iData }, { data: vData }] = await Promise.all([
      supabase.from('istruttori').select('*').order('cognome'),
      supabase.from('veicoli').select('*').order('nome')
    ]);
    setIstruttori(iData ?? []);
    setVehicles(vData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch, refreshKey]);

  const filtered = istruttori.filter(i => 
    `${i.cognome ?? ''} ${i.nome ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (i: any) => { setEditing(i); setModalOpen(true); };
  const onSuccess = () => { setModalOpen(false); fetch(); };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="pb-4 flex-shrink-0">
        <div className="relative group">
          <Search
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors",
              sectionColor === 'emerald' ? "group-focus-within:text-emerald-500" : "group-focus-within:text-sky-500"
            )}
            size={20}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca istruttore per nome…"
            className={cn(
              "w-full h-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 outline-none transition-all shadow-sm text-sm",
              sectionColor === 'emerald' ? "focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500" : "focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500"
            )}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-container pb-8">
        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className={cn("animate-spin", sectionColor === 'emerald' ? "text-emerald-500" : "text-sky-500")} size={36} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-16 text-center shadow-sm">
            <Users size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-500 font-medium font-display">Nessun istruttore registrato.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(i => {
              const initials = `${i.cognome?.[0] || ''}${i.nome?.[0] || ''}`.toUpperCase();
              return (
                <div 
                  key={i.id} 
                  className="relative bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl p-4 flex items-center justify-between gap-4 group cursor-pointer hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/5 transition-all pr-12"
                  onClick={() => openEdit(i)}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1 w-full sm:w-auto">
                    <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 font-bold text-lg flex items-center justify-center shrink-0 shadow-inner border border-sky-200/50 dark:border-sky-500/10">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-zinc-900 dark:text-white truncate">{i.cognome} {i.nome}</h4>
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1.5 min-w-0">
                        {i.telefono ? (
                          <PhoneActions phone={i.telefono} secondary />
                        ) : (
                          <span className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase italic tracking-tighter">
                            <Phone size={10} /> Da inserire
                          </span>
                        )}
                        {i.email && (
                          <a href={`mailto:${i.email}`} className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-sky-600 rounded-lg text-[10px] font-bold transition-colors truncate font-mono" onClick={e => e.stopPropagation()}>
                            <Mail size={11} /> {i.email}
                          </a>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {((i.patenti_abilitate as TipoPatente[]) || []).map(p => (
                          <span key={p} className="px-1.5 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded text-[10px] font-black tracking-widest uppercase">
                            {p}
                          </span>
                        ))}
                        {i.veicolo_id && (
                          <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                            <Car size={10} /> {vehicles.find(v => v.id === i.veicolo_id)?.nome || 'Veicolo'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="absolute top-3 right-3 z-10 flex gap-2">
                      <ConfirmBubble
                        title="Elimina Istruttore"
                        message="Sei sicuro di voler eliminare questo istruttore? L'azione è definitiva."
                        confirmLabel="Elimina"
                        onConfirm={async () => {
                          const result = await deleteIstruttoreAction(i.id);
                          if (result.success) {
                            fetch();
                          } else {
                            alert(result.error || "Errore durante l'eliminazione.");
                          }
                        }}
                        trigger={
                          <button
                            title="Elimina istruttore"
                            className={cn(
                              "p-1.5 rounded-lg text-zinc-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all border border-transparent shadow-sm bg-white dark:bg-zinc-900/80 hover:border-red-200 dark:hover:border-red-900/50",
                              !isAdmin && "hidden"
                            )}
                          >
                            <Trash2 size={16} />
                          </button>
                        }
                      />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Istruttore */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Dettagli Istruttore' : 'Nuovo Istruttore'}
      >
        <IstruttoreForm
          key={editing?.id || 'new'}
          istruttoreId={editing?.id}
          initialMode={editing ? 'view' : 'edit'}
          defaultValues={editing ? {
            nome: editing.nome ?? '',
            cognome: editing.cognome ?? '',
            telefono: editing.telefono ?? '',
            email: editing.email ?? '',
            patenti_abilitate: (editing.patenti_abilitate || []) as TipoPatente[],
            colore: editing.colore || '#3B82F6',
            veicolo_id: editing.veicolo_id,
            id: editing.id,
            updated_at: editing.updated_at,
          } : undefined}
          onSuccess={onSuccess}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

// ── Tipi per categoria patente ────────────────────────────────
const CATEGORIE: TipoPatente[] = [
  'AM', 'A1', 'A2', 'A', 'B1', 'B', 'B96', 'BE',
  'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'
];

const CATEGORIA_COLOR: Record<string, string> = {
  AM: 'violet', A1: 'blue', A2: 'blue', A: 'blue',
  B1: 'amber', B: 'amber', B96: 'amber', BE: 'orange',
  C1: 'emerald', C1E: 'emerald', C: 'emerald', CE: 'emerald',
  D1: 'rose', D1E: 'rose', D: 'rose', DE: 'rose',
};

// ── Componente Card Singola Patente ───────────────────────────
const PatenteCard = ({
  pat,
  onEdit,
}: {
  pat: Patente;
  onEdit: (p: Patente) => void;
}) => {
  const c = CATEGORIA_COLOR[pat.tipo] ?? 'zinc';
  const veicoliAbilitatiCount = pat.veicoli_abilitati?.length || 0;

  return (
    <div className={cn(
      "bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl p-4 flex items-center justify-between group transition-all hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/5 cursor-pointer",
      pat.nascosta && "opacity-60 grayscale-[0.5]"
    )} onClick={() => onEdit(pat)}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 transition-all shadow-md",
          c === 'violet' ? "bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-violet-500/20" :
          c === 'blue' ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-blue-500/20" :
          c === 'amber' ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-500/20" :
          c === 'orange' ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-orange-500/20" :
          c === 'emerald' ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/20" :
          c === 'rose' ? "bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/20" :
          "bg-gradient-to-br from-zinc-400 to-zinc-600 text-white shadow-zinc-500/20"
        )}>
          {pat.tipo}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-zinc-900 dark:text-white">
              {pat.nome_visualizzato || `Patente ${pat.tipo}`}
            </h4>
            {pat.nascosta && (
              <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-wide rounded-md">
                Disattivata
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><Clock size={12} /> {pat.durata_default} min</span>
            <span className="flex items-center gap-1 capitalize"><Car size={12} /> {veicoliAbilitatiCount} veicoli</span>
            <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md text-[10px] font-bold uppercase tracking-tighter">
              {pat.cambio_ammesso}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Pencil size={18} className="text-zinc-300 group-hover:text-purple-500 opacity-0 group-hover:opacity-100 transition-all" />
      </div>
    </div>
  );
};

// ── Tab: Patenti ──────────────────────────────────────────────
const TabPatenti = ({ refreshKey, sectionColor }: { refreshKey: number, sectionColor: string }) => {
  const [loading, setLoading] = useState(true);
  const [patenti, setPatenti] = useState<Patente[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Patente | null>(null);
  const [mostraNascoste, setMostraNascoste] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('patenti').select('*').order('tipo');
    setPatenti(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  const openEdit = (p: Patente) => {
    setEditing(p);
    setModalOpen(true);
  };

  const onSuccess = () => {
    setModalOpen(false);
    fetchData();
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="animate-spin text-sky-500" size={36} />
      </div>
    );
  }

  const patentiFiltrate = CATEGORIE.map(tipo => {
    const isMoto = ['AM', 'A1', 'A2', 'A'].includes(tipo);
    const existing = patenti.find(p => p.tipo === tipo);
    return existing || {
      tipo,
      nome_visualizzato: `Patente ${tipo}`,
      durata_default: 60,
      cambio_ammesso: isMoto ? 'entrambi' : 'manuale',
      veicoli_abilitati: [],
      nascosta: false,
    } as unknown as any; // Using unknown as any for now to satisfy complex type requirements while avoiding direct any
  });

  const patentiVisibili = patentiFiltrate.filter(p => !p.nascosta);
  const patentiNascosteCount = patentiFiltrate.length - patentiVisibili.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 flex-shrink-0">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
            Configura le {CATEGORIE.length} categorie della normativa vigente.
          </p>
        </div>
        {patentiNascosteCount > 0 && (
          <button
            onClick={() => setMostraNascoste(prev => !prev)}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-purple-600 transition-colors"
          >
            {mostraNascoste ? <EyeOff size={14} /> : <Eye size={14} />}
            {mostraNascoste ? 'Nascondi disattivate' : `Mostra ${patentiNascosteCount} disattivate`}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scroll-container pb-8 -mx-1 px-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {patentiFiltrate.filter(p => mostraNascoste || !p.nascosta).map((pat: Patente) => (
            <PatenteCard
              key={pat.tipo}
              pat={pat}
              onEdit={openEdit}
            />
          ))}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Modifica Categoria ${editing?.tipo || ''}`}
      >
        <PatenteForm
          key={editing?.tipo || 'edit'}
          tipoId={editing?.tipo}
          defaultValues={editing ? {
            tipo: editing.tipo,
            nome: editing.nome_visualizzato,
            durata: editing.durata_default,
            cambio: editing.cambio_ammesso,
            veicoli: editing.veicoli_abilitati,
            nascosta: editing.nascosta,
          } : undefined}
          onSuccess={onSuccess}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

// ── Tab: Utenti ───────────────────────────────────────────────
const TabUtenti = ({ refreshKey, sectionColor }: { refreshKey: number, sectionColor: string }) => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [istruttoriList, setIstruttoriList] = useState<{id: string; nome: string; cognome: string}[]>([]);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const [result, { data: istData }] = await Promise.all([
      listUsersAction(),
      supabase.from('istruttori').select('id, nome, cognome').order('cognome'),
    ]);
    if (result.users) {
      setUsers(result.users);
    }
    setIstruttoriList(istData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshKey]);

  const handleAssociaIstruttore = async (userId: string, istruttoreId: string) => {
    setSavingUserId(userId);
    const result = await updateUserAction(userId, {
      istruttore_id: istruttoreId || null,
    });
    if (result.error) {
      alert('Errore: ' + result.error);
    } else {
      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            user_metadata: {
              ...u.user_metadata,
              istruttore_id: istruttoreId || null,
            },
          };
        }
        return u;
      }));
    }
    setSavingUserId(null);
  };

  const handleEditSuccess = () => {
    setEditingUser(null);
    fetchUsers();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto scroll-container pb-8 -mx-1 px-1">
        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className="animate-spin text-emerald-500" size={36} />
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-16 text-center shadow-sm">
            <Users size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-500 font-medium font-display">Nessun utente trovato.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {users.map((user) => {
              const role = user.user_metadata?.role || 'user';
              const fullName = user.user_metadata?.full_name || 'Utente';
              const linkedIstruttoreId = user.user_metadata?.istruttore_id || '';
              const linkedIstruttore = istruttoriList.find(i => i.id === linkedIstruttoreId);
              const initials = fullName
                .split(' ')
                .filter(Boolean)
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

                return (
                <div 
                  key={user.id} 
                  onClick={() => setEditingUser(user)}
                  className="bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-lg text-white shadow-lg font-display",
                      role === 'admin' ? "bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/20" :
                        role === 'istruttore' ? "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/20" :
                          "bg-gradient-to-br from-zinc-400 to-zinc-600 shadow-zinc-500/20"
                    )}>
                      {initials || <UserIcon size={20} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-zinc-900 dark:text-white truncate">{fullName}</h4>
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                          role === 'admin' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                            role === 'istruttore' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                              "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        )}>
                          {role === 'admin' ? 'Admin' : role}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate font-mono mt-0.5">{user.email}</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-zinc-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Modifica Utente */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Modifica Utente"
      >
        <UserForm
          user={editingUser}
          onSuccess={handleEditSuccess}
          onCancel={() => setEditingUser(null)}
        />
      </Modal>
    </div>
  );
};

// ── Tab: Impegni (Altri Impegni) ─────────────────────────────
const TabImpegni = ({ refreshKey, sectionColor }: { refreshKey: number, sectionColor: string }) => {
  const [loading, setLoading] = useState(true);
  const [impegni, setImpegni] = useState<any[]>([]);
  const [istruttori, setIstruttori] = useState<any[]>([]);
  const [selectedIstruttoreId, setSelectedIstruttoreId] = useState<string>('all');
  const [showStorico, setShowStorico] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [{ data: aptData, error: aptError }, { data: istData }] = await Promise.all([
      supabase
        .from('appuntamenti')
        .select(`
          id, data, durata, stato, note, istruttore_id, 
          clienti!inner(id, nome, cognome),
          istruttori(id, nome, cognome, colore)
        `)
        .eq('clienti.nome', 'UFFICIO')
        .order('data', { ascending: false }),
      supabase.from('istruttori').select('id, nome, cognome').order('cognome')
    ]);
    
    setIstruttori(istData ?? []);

    if (aptError) {
      console.error("Error fetching impegni:", aptError);
      setImpegni([]);
    } else {
      const mapped = (aptData || []).map((a: any) => ({
        id: a.id,
        tipo: a.clienti.cognome,
        data: a.data,
        durata: a.durata,
        note: a.note,
        stato: a.stato,
        istruttore: a.istruttori,
        istruttore_id: a.istruttore_id,
        ora_inizio: format(new Date(a.data), 'HH:mm'),
      }));
      setImpegni(mapped);
    }
    setLoading(false);
  }, []);

  // handleDelete removed, moved to ConfirmBubble trigger

  const handleClone = (i: ImpegnoDettagliato) => {
    // Apriamo il form con gli stessi valori ma senza ID per creare un nuovo record
    const clone = { ...i };
    delete (clone as any).id;
    delete (clone as any).created_at;
    delete (clone as any).updated_at;
    // Impostiamo la data a oggi per default nel clone
    clone.data = new Date().toISOString().split('T')[0];
    
    setEditing(clone as any);
    setModalOpen(true);
  };

  useEffect(() => { fetch(); }, [fetch, refreshKey]);

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Generate last 24 months for selector
  const monthOptions = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy', { locale: it })
      };
    });
  }, []);

  const filtered = impegni.filter(i => {
    if (selectedIstruttoreId !== 'all' && i.istruttore_id !== selectedIstruttoreId) return false;
    
    const impegnoDate = new Date(i.data);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (showStorico) {
      if (!selectedMonth) return impegnoDate < today;
      return format(impegnoDate, 'yyyy-MM') === selectedMonth && impegnoDate < today;
    } else {
      return impegnoDate >= today;
    }
  });

  const openEdit = (i: any) => { setEditing(i); setModalOpen(true); };
  const onSuccess = () => { setModalOpen(false); fetch(); };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* FILTRI - Fixed */}
      <div className="pb-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-2 items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-2xl shadow-sm">
          <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl w-full sm:w-fit shadow-inner">
            <button 
              onClick={() => setShowStorico(false)}
              className={cn(
                "flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                !showStorico ? "bg-white dark:bg-zinc-700 text-orange-600 shadow-sm" : "text-zinc-500"
              )}
            >
              In Programma
            </button>
            <button 
              onClick={() => setShowStorico(true)}
              className={cn(
                "flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                showStorico ? "bg-white dark:bg-zinc-700 text-orange-600 shadow-sm" : "text-zinc-500"
              )}
            >
              Storico
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            {showStorico && (
              <div className="w-full sm:w-[160px] relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 pr-8 text-[10px] font-black uppercase tracking-wider outline-none focus:border-orange-500 transition-all text-zinc-900 dark:text-white appearance-none cursor-pointer capitalize"
                >
                  {monthOptions.map((m: { value: string, label: string }) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={14} />
              </div>
            )}
            <div className="w-full sm:w-[200px]">
              <Select
                options={[
                  { id: 'all', label: 'Tutti gli Istruttori' },
                  ...istruttori.map(ist => ({
                    id: ist.id,
                    label: `${ist.cognome} ${ist.nome}`,
                    color: ist.colore
                  }))
                ]}
                value={selectedIstruttoreId}
                onChange={(val) => setSelectedIstruttoreId(val)}
                icon={UserIcon}
                placeholder="Filtra Istruttore"
                searchable
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-container pb-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center font-bold text-zinc-400 gap-3">
            <Loader2 className="animate-spin text-sky-500" size={32} /> 
            <span className="text-sm font-medium uppercase tracking-widest">Caricamento impegni...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-16 text-center shadow-sm">
            <Clock size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-500 font-medium">
              {selectedIstruttoreId !== 'all' ? 'Nessun impegno per questo istruttore.' : 'Nessun impegno trovato.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(i => (
            <div 
              key={i.id} 
              onClick={() => openEdit(i)}
              className={cn(
                "relative border border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl p-4 flex items-center justify-between group cursor-pointer transition-all pr-24",
                i.stato === 'annullato' ? "opacity-60 grayscale bg-zinc-50 dark:bg-zinc-950" : "bg-white dark:bg-zinc-900/50 hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/5"
              )}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md bg-gradient-to-br from-orange-400 to-orange-600 text-white"
                >
                  <Clock size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight",
                      i.stato === 'annullato' && "line-through text-zinc-500"
                    )}>
                      {i.tipo}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500 font-bold uppercase tracking-widest">
                      {i.istruttore?.cognome} {i.istruttore?.nome}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-400 font-bold">
                    <span className="flex items-center gap-1 font-mono uppercase tracking-tighter">
                      {format(new Date(i.data), 'dd MMM yyyy', { locale: it })}
                    </span>
                    <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 rounded uppercase">{i.ora_inizio.slice(0, 5)}</span>
                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 rounded text-[10px] uppercase font-black tracking-widest">
                      {Number(i.durata) <= 60 
                        ? `${i.durata}m` 
                        : `${Math.floor(Number(i.durata) / 60)}h${Number(i.durata) % 60 > 0 ? ` e ${Number(i.durata) % 60}m` : ''}`
                      }
                    </span>
                  </div>
                </div>
              </div>
              <div className="absolute top-3 right-3 z-10 flex gap-1.5 items-center">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleClone(i); }} 
                  title="Duplica"
                  className="p-1.5 text-zinc-300 hover:text-blue-500 transition-all border border-transparent shadow-sm bg-white dark:bg-zinc-900/80 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg hover:border-blue-200 dark:hover:border-blue-900/50"
                >
                  <Copy size={16} />
                </button>
                {i.stato !== 'annullato' && (
                  <ConfirmBubble
                    title="Annulla Impegno"
                    message="Vuoi annullare questo impegno? Resterà visibile nello storico."
                    confirmLabel="Annulla"
                    onConfirm={async () => {
                      const result = await cancelAppointmentAction(i.id);
                      if (result.success) {
                        fetch();
                      } else {
                        alert(result.error || "Errore durante l'annullamento.");
                      }
                    }}
                    trigger={
                      <button 
                        title="Annulla"
                        className="p-1.5 text-zinc-300 hover:text-orange-500 transition-all border border-transparent shadow-sm bg-white dark:bg-zinc-900/80 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg hover:border-orange-200 dark:hover:border-orange-900/50"
                      >
                        <X size={16} />
                      </button>
                    }
                  />
                )}
                <ConfirmBubble
                  title="Elimina Impegno"
                  message="Sei sicuro di voler eliminare questo impegno?"
                  confirmLabel="Elimina"
                  onConfirm={async () => {
                    const result = await deleteAppointmentAction(i.id);
                    if (result.success) {
                      fetch();
                    } else {
                      alert(result.error || "Errore durante l'eliminazione.");
                    }
                  }}
                  trigger={
                    <button 
                      title="Elimina"
                      className="p-1.5 text-zinc-300 hover:text-red-500 transition-all border border-transparent shadow-sm bg-white dark:bg-zinc-900/80 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg hover:border-red-200 dark:hover:border-red-900/50"
                    >
                      <Trash2 size={16} />
                    </button>
                  }
                />
              </div>
            </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Dettagli Impegno">
        <AppointmentForm 
          appointmentId={editing?.id} 
          onSuccess={onSuccess} 
          onCancel={() => setModalOpen(false)} 
        />
      </Modal>
    </div>
  );
};

// ── Tab: Report ───────────────────────────────────────────────
const TabReport = ({ refreshKey, role, istruttoreId }: { refreshKey: number, role?: string, istruttoreId?: string }) => {
  const [loading, setLoading] = useState(true);
  const [istruttori, setIstruttori] = useState<any[]>([]);
  const [patenti, setPatenti] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  
  // Filtri
  const [selectedIstruttori, setSelectedIstruttori] = useState<string[]>([]);
  const [selectedPatente, setSelectedPatente] = useState<string>('all');
  const [selectedImpegno, setSelectedImpegno] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);

  // Generate last 12 months for selector
  const monthOptions = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const d = addDays(new Date(), -i * 30); // Approximate, better use subMonths if available
      // Let's use subMonths logic:
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy', { locale: it })
      };
    });
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    
    let query = supabase.from('appuntamenti')
      .select('*, clienti(*), istruttori(*)')
      .gte('data_solo', `${selectedMonth}-01`)
      .lt('data_solo', format(addDays(new Date(`${selectedMonth}-01`), 32), 'yyyy-MM-01'));
    
    if (role === 'istruttore' && istruttoreId) {
      query = query.eq('istruttore_id', istruttoreId);
    }

    const [
      { data: iData }, 
      { data: pData }, 
      { data: aData }
    ] = await Promise.all([
      supabase.from('istruttori').select('*').order('cognome'),
      supabase.from('patenti').select('*').order('tipo'),
      query
    ]);
    
    setIstruttori(iData ?? []);
    setPatenti(pData ?? []);
    setAppointments(aData ?? []);
    setLoading(false);
  }, [selectedMonth, refreshKey, role, istruttoreId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Logica di filtraggio locale per performance
  const filteredData = appointments.filter(a => {
    // Filtro Istruttori (Multiselect)
    if (selectedIstruttori.length > 0 && !selectedIstruttori.includes(a.istruttore_id)) return false;
    
    // Filtro Patente
    if (selectedPatente !== 'all' && a.clienti?.patente_richiesta_id !== selectedPatente) return false;

    // Filtro Altro Impegno (Tipo)
    if (selectedImpegno !== 'all') {
       if (a.clienti?.nome === 'UFFICIO') {
          if (a.clienti?.cognome !== selectedImpegno) return false;
       } else {
          return false; // Se cerchiamo un impegno specifico e questa è una guida, la escludiamo
       }
    }

    return true;
  });

  // Calcoli Guide
  const guide = filteredData.filter(a => a.clienti?.nome !== 'UFFICIO');
  const guideCount = guide.length;
  const guideMinutes = guide.reduce((acc, curr) => acc + (curr.durata || 0), 0);

  // Calcoli Altri Impegni
  const impegni = filteredData.filter(a => a.clienti?.nome === 'UFFICIO');
  const impegniTimeByType = impegni.reduce((acc, curr) => {
    const tipo = curr.clienti?.cognome || 'ALTRO';
    acc[tipo] = (acc[tipo] || 0) + (curr.durata || 0);
    return acc;
  }, {} as Record<string, number>);

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h} h${m > 0 ? `, ${m} min` : ''}`;
  };

  // Ripartizione Guide per Patente
  const getGuideByPatente = (tipi: string[]) => {
    const list = guide.filter(a => {
      const p = patenti.find(p => p.id === a.clienti?.patente_richiesta_id);
      return p && tipi.includes(p.tipo);
    });
    return {
      count: list.length,
      duration: list.reduce((acc, curr) => acc + (curr.durata || 0), 0)
    };
  };

  const statsB = getGuideByPatente(['B']);
  const statsMoto = getGuideByPatente(['A1', 'A2', 'A3', 'A']); // Includo A per completezza moto
  const statsAM = getGuideByPatente(['AM']);
  const statsAltre = {
    count: guideCount - (statsB.count + statsMoto.count + statsAM.count),
    duration: guideMinutes - (statsB.duration + statsMoto.duration + statsAM.duration)
  };

  const typesOfImpegni = Array.from(new Set(appointments.filter(a => a.clienti?.nome === 'UFFICIO').map(a => a.clienti?.cognome))).filter(Boolean);

  const toggleIstruttore = (id: string) => {
    setSelectedIstruttori(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden min-h-0">
      <PrintStyles />
      
      {/* FILTRI REPORT - Hidden on Print */}
      <div className="pb-4 flex-shrink-0 print:hidden">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden transition-all duration-300">
          <button 
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search size={16} className="text-zinc-400 shrink-0" />
              <span className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white truncate">Filtri Report</span>
              {!isFiltersOpen && (
                <span className="text-[10px] font-bold text-sky-500 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                  {format(new Date(`${selectedMonth}-01`), 'MMMM', { locale: it })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isFiltersOpen && (
                <button
                  onClick={(e) => { e.stopPropagation(); window.print(); }}
                  className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  title="Stampa veloce"
                >
                  <Printer size={16} />
                </button>
              )}
              <ChevronDown 
                size={18} 
                className={cn("text-zinc-400 transition-transform duration-300", !isFiltersOpen && "rotate-180")} 
              />
            </div>
          </button>

          {isFiltersOpen && (
            <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Mese */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Periodo</label>
                  <div className="relative">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full h-11 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 pr-10 text-sm font-bold outline-none focus:border-sky-500 transition-all appearance-none cursor-pointer capitalize"
                    >
                      {monthOptions.map((m: { value: string, label: string }) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Patente</label>
                  <div className="relative">
                    <select
                      value={selectedPatente}
                      onChange={(e) => setSelectedPatente(e.target.value)}
                      className="w-full h-11 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 pr-10 text-sm font-bold outline-none focus:border-sky-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="all">Tutte le Patenti</option>
                      {patenti.filter(p => !p.nascosta).map(p => (
                        <option key={p.id} value={p.id}>{p.tipo}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                  </div>
                </div>

                {/* Tipo Impegno */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Tipo Impegno</label>
                  <div className="relative">
                    <select
                      value={selectedImpegno}
                      onChange={(e) => setSelectedImpegno(e.target.value)}
                      className="w-full h-11 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 pr-10 text-sm font-bold outline-none focus:border-sky-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="all">Tutti (Guide + Impegni)</option>
                      {typesOfImpegni.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                  </div>
                </div>
              </div>

              {/* Multiselect Istruttori */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Istruttori</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedIstruttori([])}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter border transition-all",
                      selectedIstruttori.length === 0 
                      ? "bg-zinc-900 text-white border-zinc-900 shadow-lg" 
                      : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
                    )}
                  >
                    Tutti
                  </button>
                  {istruttori.map(ist => (
                    <button
                      key={ist.id}
                      onClick={() => toggleIstruttore(ist.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter border transition-all flex items-center gap-1.5",
                        selectedIstruttori.includes(ist.id)
                        ? "bg-sky-50 text-sky-600 border-sky-200 shadow-sm"
                        : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-sky-200"
                      )}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ist.colore }} />
                      {ist.cognome} {ist.nome}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex flex-col items-end gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg hover:bg-zinc-800 transition-all active:scale-95 shadow-zinc-500/20"
                >
                  <Printer size={14} />
                  Stampa PDF / Excel
                </button>
                <p className="text-[9px] text-zinc-400 font-medium italic">
                  Tip: Su iOS, usa "Stampa" e poi l'icona "Condividi" per salvare come PDF.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RISULTATI REPORT */}
      <div className="flex-1 overflow-y-auto scroll-container pb-20 print:p-0 no-scrollbar">
        <div className="grid gap-6">
          
          {/* Header Stampa (Solo print) */}
          <div className="hidden print:block mb-8 border-b-2 border-zinc-900 pb-4">
            <h1 className="text-3xl font-black uppercase tracking-tighter">Report Attività</h1>
            <div className="flex justify-between items-end mt-2">
              <p className="text-sm font-bold text-zinc-600 uppercase">Periodo: {format(new Date(`${selectedMonth}-01`), 'MMMM yyyy', { locale: it })}</p>
              <p className="text-xs text-zinc-400 italic">Generato il {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </div>

          {/* Sezione 1: Guide */}
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-[32px] p-6 shadow-sm print:rounded-none print:shadow-none print:border-zinc-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center print:bg-emerald-50">
                <Car size={20} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">Statistiche Guide</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 print:bg-white print:border-zinc-200">
                <p className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest mb-1">Totale Guide</p>
                <p className="text-3xl font-black text-black dark:text-white">{guideCount}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 print:bg-white print:border-zinc-200">
                <p className="text-[10px] font-black text-black dark:text-white uppercase tracking-widest mb-1">Somma Ore</p>
                <p className="text-3xl font-black text-black dark:text-white">{formatDuration(guideMinutes)}</p>
              </div>
            </div>

            {/* Dettaglio Ripartizione */}
            <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 grid gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-black dark:text-white bg-zinc-50 dark:bg-zinc-800/20 p-3 rounded-xl border border-zinc-100/50 dark:border-zinc-800/50">
                <span className="uppercase tracking-tight">Guide B</span>
                <span className="font-black text-black dark:text-white">{statsB.count} Guide + {formatDuration(statsB.duration)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-black dark:text-white bg-zinc-50 dark:bg-zinc-800/20 p-3 rounded-xl border border-zinc-100/50 dark:border-zinc-800/50">
                <span className="uppercase tracking-tight">Guide Moto (A1-A2-A3)</span>
                <span className="font-black text-black dark:text-white">{statsMoto.count} Guide + {formatDuration(statsMoto.duration)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-black dark:text-white bg-zinc-50 dark:bg-zinc-800/20 p-3 rounded-xl border border-zinc-100/50 dark:border-zinc-800/50">
                <span className="uppercase tracking-tight">Guide AM</span>
                <span className="font-black text-black dark:text-white">{statsAM.count} Guide + {formatDuration(statsAM.duration)}</span>
              </div>
              {statsAltre.count > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-zinc-500 p-3 rounded-xl border border-transparent">
                  <span className="uppercase tracking-tight">Altre Guide (C/D/E)</span>
                  <span className="font-black">{statsAltre.count} Guide • {formatDuration(statsAltre.duration)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sezione 2: Altri Impegni */}
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-[32px] p-6 shadow-sm print:rounded-none print:shadow-none print:border-zinc-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center print:bg-orange-50">
                <Clock size={20} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">Altri Impegni</h3>
            </div>

            {Object.keys(impegniTimeByType).length === 0 ? (
              <p className="text-center py-8 text-zinc-400 font-medium">Nessun impegno extra registrato nel periodo.</p>
            ) : (
              <div className="grid gap-3">
                {Object.entries(impegniTimeByType).map(([tipo, mins]) => (
                  <div key={tipo} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800 print:bg-white print:border-zinc-200">
                    <div>
                      <p className="text-xs font-black text-black dark:text-white uppercase tracking-wider">{tipo}</p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        {impegni.filter((i: any) => i.clienti?.cognome === tipo).length} Sessioni
                      </p>
                    </div>
                    <p className="text-lg font-black text-black dark:text-white">{formatDuration(mins as number)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Page principale ───────────────────────────────────────────
type GestioneTab = 'veicoli' | 'istruttori' | 'patenti' | 'utenti' | 'impegni' | 'report' | 'mobile' | 'impostazioni';

const TABS: { id: GestioneTab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'veicoli', label: 'Veicoli', icon: Car, color: 'emerald' },
  { id: 'istruttori', label: 'Istruttori', icon: Users, color: 'blue' },
  { id: 'impegni', label: 'Altri Impegni', icon: Clock, color: 'orange' },
  { id: 'report', label: 'Report', icon: BadgeCheck, color: 'sky' },
  { id: 'patenti', label: 'Patenti', icon: BadgeCheck, color: 'purple' },
  { id: 'utenti', label: 'Utenti', icon: ShieldCheck, color: 'indigo' },
  { id: 'impostazioni', label: 'Impostazioni', icon: Key, color: 'amber' },
  { id: 'mobile', label: 'App Mobile', icon: Smartphone, color: 'blue' },
];

// ── Tab: Impostazioni ─────────────────────────────────────────
const TabImpostazioni = () => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ hide_gestione_for_others: false });

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('impostazioni_sistema').select('*').eq('id', 'config_globale').single();
      if (data) setConfig(data);
      setLoading(false);
    }
    load();
  }, []);

  const toggleHide = async () => {
    const newValue = !config.hide_gestione_for_others;
    const { error } = await supabase.from('impostazioni_sistema').update({ hide_gestione_for_others: newValue }).eq('id', 'config_globale');
    if (!error) setConfig({ ...config, hide_gestione_for_others: newValue });
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
          <ShieldCheck className="text-amber-500" />
          Restrizioni Accesso
        </h3>
        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div>
            <p className="font-bold text-zinc-900 dark:text-white">Nascondi Gestione</p>
            <p className="text-xs text-zinc-500">Nasconde le schede tecniche a Istruttori e Ufficio (mostra solo Report e Impegni).</p>
          </div>
          <button 
            onClick={toggleHide}
            className={cn(
              "w-12 h-6 rounded-full transition-all relative",
              config.hide_gestione_for_others ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-700"
            )}
          >
            <div className={cn(
              "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
              config.hide_gestione_for_others ? "right-1" : "left-1"
            )} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function GestionePage() {
  const { role, isAdmin, isSegreteria, isIstruttore, istruttoreId } = useAuth();
  const [active, setActive] = useState<GestioneTab>('report'); // Default to report for better safety
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hideGestione, setHideGestione] = useState(false);

  useEffect(() => {
    async function checkInhibition() {
      const { data } = await supabase.from('impostazioni_sistema').select('hide_gestione_for_others').eq('id', 'config_globale').single();
      if (data) setHideGestione(data.hide_gestione_for_others);
    }
    checkInhibition();
  }, []);

  // Filter tabs based on role and admin settings
  const filteredTabs = TABS.filter(tab => {
    if (isAdmin) return true;
    
    // Logic for others
    const isRestrictedByAdmin = hideGestione && (isIstruttore || isSegreteria);
    
    if (isRestrictedByAdmin) {
      return tab.id === 'report' || tab.id === 'impegni';
    }

    if (isIstruttore) {
      return tab.id === 'report' || tab.id === 'impegni';
    }

    if (isSegreteria) {
      return ['veicoli', 'patenti', 'impegni', 'report'].includes(tab.id);
    }

    return tab.id === 'report'; // Safety fallback
  });

  // Ensure active tab is within filtered tabs
  useEffect(() => {
    if (filteredTabs.length > 0 && !filteredTabs.find(t => t.id === active)) {
      setActive(filteredTabs[0].id as GestioneTab);
    }
  }, [filteredTabs, active]);

  const Tab = TABS.find(t => t.id === active) || filteredTabs[0];
  const Icon = Tab?.icon || Wrench;

  const handleAddSuccess = () => {
    setIsAddModalOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  const getSectionColor = () => {
    if (active === 'veicoli' || active === 'utenti') return 'emerald';
    if (active === 'patenti') return 'sky';
    if (active === 'istruttori') return 'sky';
    return 'blue';
  };

  const sectionColor = getSectionColor();

  const getAddTitle = () => {
    switch (active) {
      case 'veicoli': return 'Nuovo Veicolo';
      case 'istruttori': return 'Nuovo Istruttore';
      case 'patenti': return 'Nuova Patente';
      case 'utenti': return 'Nuovo Utente';
      case 'impegni': return 'Nuovo Impegno';
      default: return 'Nuovo';
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in overflow-hidden">
      <PrintStyles />
      
      {/* Page Header - Fixed */}
      <header className="pt-6 px-4 md:px-8 pb-4 flex-shrink-0 animate-in fade-in duration-500 print-hidden">
        <div className="max-w-5xl mx-auto flex justify-between items-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl p-4 rounded-[32px] border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-[22px] flex items-center justify-center shadow-lg transition-all",
              `bg-${sectionColor}-500 text-white shadow-${sectionColor}-500/20`
            )}>
              <Icon size={24} strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-none">
                {Tab?.label}
              </h1>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Amministrazione
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={() => setRefreshKey(prev => prev + 1)} />
            {(active === 'veicoli' || active === 'istruttori' || active === 'patenti' || active === 'utenti') && isAdmin && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-[20px] font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg",
                  `bg-zinc-900 dark:bg-sky-500 text-white shadow-zinc-900/20 dark:shadow-sky-500/20`
                )}
              >
                <Plus size={16} strokeWidth={3} />
                <span className="hidden sm:inline">{getAddTitle()}</span>
              </button>
            )}
            {/* Forza Refresh Button for Debug / PWA Sync */}
            <button 
              onClick={() => { if (typeof window !== 'undefined') window.location.href = window.location.pathname + '?v=' + new Date().getTime(); }}
              className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[9px] font-black rounded-lg uppercase tracking-tighter border border-red-200 dark:border-red-900/30 transition-all hidden sm:block"
            >
              Forza Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Tabs Menu - Scrollable */}
      <nav className="px-4 md:px-8 pb-4 flex-shrink-0 animate-in fade-in slide-in-from-top-4 duration-500 delay-150 print-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="flex bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md p-1.5 rounded-[22px] border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm overflow-x-auto no-scrollbar scrollbar-hide">
            {filteredTabs.map(tab => {
              const TabIcon = tab.icon;
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id as GestioneTab)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex-shrink-0",
                    isActive 
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700" 
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  )}
                >
                  <TabIcon size={14} strokeWidth={3} className={isActive ? `text-${tab.color}-500` : ""} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden px-4 md:px-8 relative">
        <div className="max-w-5xl mx-auto h-full flex flex-col pt-2 pb-32 no-scrollbar">
          <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 overflow-hidden h-full">
            {active === 'veicoli' && <TabVeicoli refreshKey={refreshKey} sectionColor={sectionColor} isAdmin={isAdmin} />}
            {active === 'istruttori' && <TabIstruttori refreshKey={refreshKey} sectionColor={sectionColor} isAdmin={isAdmin} />}
            {active === 'report' && <TabReport refreshKey={refreshKey} role={role || undefined} istruttoreId={istruttoreId || undefined} />}
            {active === 'patenti' && <TabPatenti refreshKey={refreshKey} sectionColor={sectionColor} />}
            {active === 'utenti' && <TabUtenti refreshKey={refreshKey} sectionColor={sectionColor} />}
            {active === 'impostazioni' && <TabImpostazioni />}
            {active === 'mobile' && <InstallPWA />}
            {active === 'impegni' && <TabImpegni refreshKey={refreshKey} sectionColor={sectionColor} />}
          </div>
        </div>
      </main>

      {/* Modale Aggiunta Universale */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={getAddTitle()}
      >
        <div className="mt-2">
          {active === 'veicoli' && <VeicoloForm onSuccess={handleAddSuccess} onCancel={() => setIsAddModalOpen(false)} />}
          {active === 'istruttori' && <IstruttoreForm onSuccess={handleAddSuccess} onCancel={() => setIsAddModalOpen(false)} />}
          {active === 'patenti' && <PatenteForm onSuccess={handleAddSuccess} onCancel={() => setIsAddModalOpen(false)} />}
          {active === 'utenti' && <UserForm onSuccess={handleAddSuccess} onCancel={() => setIsAddModalOpen(false)} />}
          {active === 'impegni' && <ImpegnoForm onSuccess={handleAddSuccess} onCancel={() => setIsAddModalOpen(false)} />}
        </div>
      </Modal>
    </div>
  );
}
