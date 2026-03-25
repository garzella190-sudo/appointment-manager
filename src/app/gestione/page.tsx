'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { listUsersAction, updateUserAction } from '@/actions/auth';
import { deleteVeicoloAction } from '@/actions/veicoli';
import { deleteIstruttoreAction } from '@/actions/istruttori';
import { deleteAppointmentAction, cancelAppointmentAction } from '@/actions/appointment_actions';
import { useRevisionReminder } from '@/hooks/useRevisionReminder';
import {
  AlertTriangle, CheckCircle2, Phone, Mail, Search,
  Clock, EyeOff, Eye, Copy,
  Car, BadgeCheck, Users, Plus, Pencil, Loader2, ShieldCheck, Key, User as UserIcon, Trash2, Smartphone, X
} from 'lucide-react';
import Select from '@/components/forms/Select';
import { cn } from '@/lib/utils';
import { User as AuthUser } from '@supabase/supabase-js';
import { PhoneActions } from '@/components/PhoneActions';
import { ConfirmBubble } from '@/components/ConfirmBubble';
import { RefreshButton } from '@/components/RefreshButton';

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
const TabVeicoli = ({ refreshKey }: { refreshKey: number }) => {
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
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-500 transition-colors"
            size={20}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome o targa…"
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2 pl-12 pr-4 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-container pb-8">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-zinc-400">
            <Loader2 className="animate-spin text-emerald-500" size={40} />
            <p className="text-sm font-medium">Caricamento veicoli…</p>
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
                  className="bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center shrink-0 font-bold text-xl"
                    >
                      {initials || <Car size={26} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-zinc-900 dark:text-white truncate">
                          {v.nome}
                        </h4>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded tracking-widest leading-none border border-zinc-200/50 dark:border-zinc-700">
                          {v.targa}
                        </span>
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-1.5">
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-black uppercase tracking-wider">
                          Pat. {v.tipo_patente}
                        </span>
                        <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md text-[10px] font-bold">
                          {v.cambio_manuale ? 'Manuale' : 'Automatico'}
                        </span>
                        <RevisionBadge dataRevisione={v.data_revisione} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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
                          className="p-2 rounded-xl text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all"
                          title="Elimina veicolo"
                        >
                          <Trash2 size={18} />
                        </button>
                      }
                    />
                    <Pencil
                      size={18}
                      className="text-zinc-300 group-hover:text-emerald-500 transition-colors shrink-0"
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
const TabIstruttori = ({ refreshKey }: { refreshKey: number }) => {
  const [loading, setLoading] = useState(true);
  const [istruttori, setIstruttori] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Veicolo[]>([]);
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


  // handleDelete removed, logic moved to ConfirmBubble onConfirm

  useEffect(() => { fetch(); }, [fetch, refreshKey]);

  const openEdit = (i: any) => { setEditing(i); setModalOpen(true); };
  const onSuccess = () => { setModalOpen(false); fetch(); };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto scroll-container pb-8 -mx-1 px-1">
        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={36} />
          </div>
        ) : istruttori.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-16 text-center shadow-sm">
            <Users size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-500 font-medium font-display">Nessun istruttore registrato.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {istruttori.map(i => {
              const initials = `${i.cognome?.[0] || ''}${i.nome?.[0] || ''}`.toUpperCase();
              return (
                <div 
                  key={i.id} 
                  className="bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all"
                  onClick={() => openEdit(i)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg shadow-blue-500/20 font-bold text-lg flex items-center justify-center shrink-0 tracking-tight font-display">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-zinc-900 dark:text-white truncate">{i.cognome} {i.nome}</h4>
                      <div className="flex flex-wrap gap-1.5 mt-1.5 min-w-0">
                        {i.telefono ? (
                          <PhoneActions phone={i.telefono} secondary />
                        ) : (
                          <span className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase italic tracking-tighter">
                            <Phone size={10} /> Da inserire
                          </span>
                        )}
                        {i.email && (
                          <a href={`mailto:${i.email}`} className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 rounded-lg text-[10px] font-bold transition-colors truncate font-mono" onClick={e => e.stopPropagation()}>
                            <Mail size={11} /> {i.email}
                          </a>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {((i.patenti_abilitate as TipoPatente[]) || []).map(p => (
                          <span key={p} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-[10px] font-black tracking-widest uppercase">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {i.veicolo_id && (
                      <div className="hidden lg:flex flex-col gap-0.5 text-right mr-2">
                        <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Default</label>
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">
                          {vehicles.find(v => v.id === i.veicolo_id)?.nome || 'Veicolo'}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 transition-all ml-auto sm:ml-0">
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
                            className="p-2 rounded-xl text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all shadow-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                        }
                      />
                      <Pencil size={18} className="text-zinc-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
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
      "glass-card p-5 flex items-center justify-between group transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer",
      pat.nascosta && "opacity-60 grayscale-[0.5]"
    )} onClick={() => onEdit(pat)}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-14 h-14 rounded-3xl flex items-center justify-center font-bold text-xl shrink-0 transition-all shadow-md",
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
const TabPatenti = ({ refreshKey }: { refreshKey: number }) => {
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
        <Loader2 className="animate-spin text-purple-500" size={36} />
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
const TabUtenti = ({ refreshKey }: { refreshKey: number }) => {
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
            <Loader2 className="animate-spin text-blue-500" size={36} />
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
                  className="bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl p-5 flex flex-col gap-4 group hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer relative focus-within:z-10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-lg text-white shadow-lg font-display",
                        role === 'admin' ? "bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/20" :
                          role === 'istruttore' ? "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/20" :
                            "bg-gradient-to-br from-zinc-400 to-zinc-600 shadow-zinc-500/20"
                      )}>
                        {initials || <UserIcon size={24} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-zinc-900 dark:text-white">{fullName}</h4>
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                            role === 'admin' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                              role === 'istruttore' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                                "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          )}>
                            {role === 'admin' ? 'Admin' : role}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-400 font-bold font-mono">
                          <span className="flex items-center gap-1 lowercase"><Mail size={12} className="opacity-70" /> {user.email}</span>
                          <span className="flex items-center gap-1 uppercase tracking-tighter opacity-70"><Key size={12} className="opacity-70" /> {user.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Associazione Istruttore */}
                  <div className="flex flex-col gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap shrink-0">
                        Istruttore
                      </label>
                      <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                        <Select
                          options={[
                            { id: '', label: 'Nessun istruttore' },
                            ...istruttoriList.map(ist => ({
                              id: ist.id,
                              label: `${ist.cognome} ${ist.nome}`
                            }))
                          ]}
                          value={linkedIstruttoreId}
                          onChange={(val) => handleAssociaIstruttore(user.id, val)}
                          placeholder="Seleziona..."
                        />
                      </div>
                      {savingUserId === user.id && <Loader2 className="animate-spin text-blue-500 shrink-0" size={16} />}
                      {linkedIstruttore && savingUserId !== user.id && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap uppercase tracking-tighter">✓ Collegato</span>
                      )}
                    </div>

                    {/* Quick Delete User */}
                    <div className="flex justify-end pt-1">
                      <ConfirmBubble
                        title="Elimina Utente"
                        message={`Sei sicuro di voler eliminare l'utente ${fullName}? L'accesso verrà immediatamente revocato.`}
                        confirmLabel="Elimina Utente"
                        onConfirm={async () => {
                          setSavingUserId(user.id);
                          const { deleteUserAction } = await import('@/actions/auth');
                          const res = await deleteUserAction(user.id);
                          if (res.success) {
                            fetchUsers();
                          } else {
                            alert(res.error || "Errore eliminazione utente");
                          }
                          setSavingUserId(null);
                        }}
                        trigger={
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                          >
                            <Trash2 size={12} /> Elimina Utente
                          </button>
                        }
                      />
                    </div>
                  </div>
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
const TabImpegni = ({ refreshKey }: { refreshKey: number }) => {
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

  const filtered = impegni.filter(i => {
    if (selectedIstruttoreId !== 'all' && i.istruttore_id !== selectedIstruttoreId) return false;
    
    const impegnoDate = new Date(i.data);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (showStorico) {
      return impegnoDate < today;
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

          <div className="w-full sm:w-[240px]">
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

      <div className="flex-1 overflow-y-auto scroll-container pb-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center font-bold text-zinc-400 gap-3">
            <Loader2 className="animate-spin text-orange-500" size={32} /> 
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
                "bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl p-4 flex items-center justify-between group cursor-pointer transition-all",
                i.stato === 'annullato' ? "opacity-60 grayscale bg-zinc-50 dark:bg-zinc-950" : "hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/5"
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
                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 rounded">{i.durata}m</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleClone(i); }} 
                  title="Duplica"
                  className="p-2 text-zinc-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
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
                        className="p-2 text-zinc-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all"
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
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  }
                />
                <Pencil size={18} className="text-zinc-300 group-hover:translate-x-0.5 transition-all" />
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

// ── Page principale ───────────────────────────────────────────
type GestioneTab = 'veicoli' | 'istruttori' | 'patenti' | 'utenti' | 'impegni' | 'mobile';

const TABS: { id: GestioneTab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'veicoli', label: 'Veicoli', icon: Car, color: 'emerald' },
  { id: 'istruttori', label: 'Istruttori', icon: Users, color: 'blue' },
  { id: 'impegni', label: 'Altri Impegni', icon: Clock, color: 'orange' },
  { id: 'patenti', label: 'Patenti', icon: BadgeCheck, color: 'purple' },
  { id: 'utenti', label: 'Utenti', icon: ShieldCheck, color: 'indigo' },
  { id: 'mobile', label: 'App Mobile', icon: Smartphone, color: 'blue' },
];

export default function GestionePage() {
  const [active, setActive] = useState<GestioneTab>('veicoli');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const Tab = TABS.find(t => t.id === active)!;
  const Icon = Tab.icon;

  const handleAddSuccess = () => {
    setIsAddModalOpen(false);
    setRefreshKey(prev => prev + 1);
  };

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
      {/* Page Header - Fixed */}
      <header className="pt-2 px-4 md:px-6 pb-4 flex-shrink-0 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-display leading-none">Gestione</h1>
          <RefreshButton onRefresh={() => setRefreshKey(prev => prev + 1)} className="h-8 w-8 p-0" />
        </div>
        <p className="text-zinc-500 dark:text-zinc-400 mt-0 text-xs font-semibold">Configura le risorse della scuola guida</p>
      </header>

      {/* Tab Management Controls - Fixed */}
      <div className="px-4 md:px-6 pb-2 flex-shrink-0 max-w-4xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-2xl w-fit overflow-x-auto max-w-full shadow-inner scrollbar-hide">
            {TABS.map(tab => {
              const TIcon = tab.icon;
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-white dark:bg-zinc-800 shadow-sm' +
                      (tab.color === 'emerald' ? ' text-emerald-600 dark:text-emerald-400' :
                        tab.color === 'blue' ? ' text-blue-600 dark:text-blue-400' :
                          tab.color === 'orange' ? ' text-orange-600 dark:text-orange-400' :
                          tab.color === 'purple' ? ' text-purple-600 dark:text-purple-400' :
                            ' text-indigo-600 dark:text-indigo-400')
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  )}
                >
                  <TIcon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 shrink-0"
          >
            <Plus size={16} />
            {getAddTitle()}
          </button>
        </div>
      </div>

      {/* Tab Content Area - Internal scrolling handled by components */}
      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-32">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            {active === 'veicoli' && <TabVeicoli refreshKey={refreshKey} />}
            {active === 'istruttori' && <TabIstruttori refreshKey={refreshKey} />}
            {active === 'impegni' && <TabImpegni refreshKey={refreshKey} />}
            {active === 'patenti' && <TabPatenti refreshKey={refreshKey} />}
            {active === 'utenti' && <TabUtenti refreshKey={refreshKey} />}
            {active === 'mobile' && <InstallPWA />}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={getAddTitle()}
      >
        {active === 'veicoli' && (
          <VeicoloForm 
            key="global-add-veicoli"
            onSuccess={handleAddSuccess} 
            onCancel={() => setIsAddModalOpen(false)} 
          />
        )}
        {active === 'istruttori' && (
          <IstruttoreForm 
            key="global-add-istruttori"
            onSuccess={handleAddSuccess} 
            onCancel={() => setIsAddModalOpen(false)} 
          />
        )}
        {active === 'impegni' && (
          <AppointmentForm 
            key="global-add-impegni"
            onSuccess={handleAddSuccess} 
            onCancel={() => setIsAddModalOpen(false)} 
            defaultIsImpegno={true}
          />
        )}
        {active === 'patenti' && (
          <PatenteForm 
            key="global-add-patenti"
            onSuccess={handleAddSuccess} 
            onCancel={() => setIsAddModalOpen(false)} 
          />
        )}
        {active === 'utenti' && (
          <UserForm 
            key="global-add-utenti"
            onSuccess={handleAddSuccess} 
            onCancel={() => setIsAddModalOpen(false)} 
          />
        )}
      </Modal>

    </div>
  );
}
