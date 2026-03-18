'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Veicolo, Patente, TipoPatente, ImpegnoDettagliato } from '@/lib/database.types';
import { Modal } from '@/components/Modal';
import { VeicoloForm } from '@/components/forms/VeicoloForm';
import { IstruttoreForm } from '@/components/forms/IstruttoreForm';
import { ImpegnoForm } from '@/components/forms/ImpegnoForm';
import { AppointmentForm } from '@/components/forms/AppointmentForm';
import { UserForm } from '@/components/forms/UserForm';
import { PatenteForm } from '@/components/forms/PatenteForm';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { listUsersAction } from '@/actions/auth';
import { deleteVeicoloAction } from '@/actions/veicoli';
import { deleteIstruttoreAction } from '@/actions/istruttori';
import { deleteAppointmentAction } from '@/actions/appointment_actions';
import { useRevisionReminder } from '@/hooks/useRevisionReminder';
import {
  AlertTriangle, CheckCircle2, Phone, Mail, Search,
  Clock, EyeOff, Eye, Copy,
  Car, BadgeCheck, Users, Plus, Pencil, Loader2, ShieldCheck, Key, User as UserIcon, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { User as AuthUser } from '@supabase/supabase-js';
import { PhoneActions } from '@/components/PhoneActions';
import SanityCheckButton from '@/components/SanityCheckButton';

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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Sei sicuro di voler eliminare questo veicolo? L'azione è irreversibile.")) return;
    const result = await deleteVeicoloAction(id);
    if (result.success) {
      fetchVeicoli();
    } else {
      alert(result.error || "Errore durante l'eliminazione.");
    }
  };

  useEffect(() => { fetchVeicoli(); }, [fetchVeicoli, refreshKey]);

  const openEdit = (v: Veicolo) => { setEditing(v); setModalOpen(true); };
  const onSuccess = () => { setModalOpen(false); fetchVeicoli(); };

  const filtered = veicoli.filter(v => 
    v.nome.toLowerCase().includes(search.toLowerCase()) || 
    v.targa.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
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
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
      </div>

      <div className="">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-zinc-400">
            <Loader2 className="animate-spin text-emerald-500" size={40} />
            <p>Caricamento veicoli…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-16 text-center">
            <Car size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-400">
              {search ? 'Nessun veicolo trovato per questa ricerca.' : 'Nessun veicolo ancora.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(v => {
              const initials = v.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              return (
                <div 
                  key={v.id}
                  onClick={() => openEdit(v)}
                  className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl p-5 flex items-center justify-between group cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-bold text-lg"
                      style={{ 
                        backgroundColor: `${v.colore}15`, 
                        color: v.colore 
                      } as React.CSSProperties}
                    >
                      {initials || <Car size={24} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-zinc-900 dark:text-white truncate">
                          {v.nome}
                        </h4>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded tracking-widest leading-none">
                          {v.targa}
                        </span>
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-1.5">
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-bold uppercase tracking-wider">
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
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(e, v.id); }}
                      className="p-2 rounded-xl text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                      title="Elimina veicolo"
                    >
                      <Trash2 size={18} />
                    </button>
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
        title={editing ? 'Modifica Veicolo' : 'Nuovo Veicolo'}
      >
        <VeicoloForm
          key={editing?.id || 'new'}
          veicoloId={editing?.id}
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


  const handleDelete = async (id: string) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo istruttore? L'azione è irreversibile.")) return;
    const result = await deleteIstruttoreAction(id);
    if (result.success) {
      fetch();
    } else {
      alert(result.error || "Errore durante l'eliminazione.");
    }
  };

  useEffect(() => { fetch(); }, [fetch, refreshKey]);

  const openEdit = (i: any) => { setEditing(i); setModalOpen(true); };
  const onSuccess = () => { setModalOpen(false); fetch(); };

  return (
    <div className="relative">
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={36} />
        </div>
      ) : istruttori.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-16 text-center">
          <Users size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
          <p className="text-zinc-400">Nessun istruttore. Clicca <strong>+</strong> per aggiungerne uno.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {istruttori.map(i => {
            const initials = `${i.cognome?.[0] || ''}${i.nome?.[0] || ''}`.toUpperCase();
            return (
              <div 
                key={i.id} 
                className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all"
                onClick={() => openEdit(i)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold text-xl flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-zinc-900 dark:text-white truncate">{i.cognome} {i.nome}</h4>
                    <div className="flex flex-wrap gap-1.5 mt-1.5 min-w-0">
                      {i.telefono ? (
                        <PhoneActions phone={i.telefono} secondary />
                      ) : (
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 rounded-lg text-[10px] font-semibold italic">
                          <Phone size={10} /> Da inserire
                        </span>
                      )}
                      {i.email && (
                        <a href={`mailto:${i.email}`} className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 rounded-lg text-[10px] font-semibold transition-colors truncate" onClick={e => e.stopPropagation()}>
                          <Mail size={11} /> {i.email}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {((i.patenti_abilitate as TipoPatente[]) || []).map(p => (
                        <span key={p} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-[10px] font-bold">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {i.veicolo_id && (
                    <div className="hidden lg:flex flex-col gap-0.5 text-right mr-2">
                      <label className="text-[9px] font-bold text-zinc-500 uppercase">Veicolo Predefinito</label>
                      <span className="text-[10px] font-bold text-blue-500">
                        {vehicles.find(v => v.id === i.veicolo_id)?.nome || 'Assegnato'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-all ml-auto sm:ml-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(i.id); }}
                      title="Elimina istruttore"
                      className="p-2 rounded-xl text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                    <Pencil size={18} className="text-zinc-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifica Istruttore' : 'Nuovo Istruttore'}
      >
        <IstruttoreForm
          key={editing?.id || 'new'}
          istruttoreId={editing?.id}
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
      "bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl p-5 flex items-center justify-between group transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer",
      pat.nascosta && "opacity-60 grayscale-[0.5]"
    )} onClick={() => onEdit(pat)}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0 transition-colors",
          `bg-${c}-100 dark:bg-${c}-900/20 text-${c}-600 dark:text-${c}-400`
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
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Configura le {CATEGORIE.length} categorie della normativa vigente.
          </p>
        </div>
        {patentiNascosteCount > 0 && (
          <button
            onClick={() => setMostraNascoste(prev => !prev)}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
          >
            {mostraNascoste ? <EyeOff size={16} /> : <Eye size={16} />}
            {mostraNascoste ? 'Nascondi disattivate' : `Mostra ${patentiNascosteCount} disattivate`}
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {patentiFiltrate.filter(p => mostraNascoste || !p.nascosta).map((pat: Patente) => (
          <PatenteCard
            key={pat.tipo}
            pat={pat}
            onEdit={openEdit}
          />
        ))}
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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const result = await listUsersAction();
    if (result.users) {
      setUsers(result.users);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshKey]);

  return (
    <div className="relative">
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={36} />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-16 text-center">
          <Users size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
          <p className="text-zinc-400">Nessun utente trovato.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => {
            const role = user.user_metadata?.role || 'user';
            const fullName = user.user_metadata?.full_name || 'Utente';
            const initials = fullName
              .split(' ')
              .filter(Boolean)
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <div key={user.id} className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl p-5 flex items-center justify-between group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-bold text-xl",
                    role === 'admin' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" :
                      role === 'istruttore' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" :
                        "bg-zinc-100 text-zinc-600 dark:bg-zinc-900/20 dark:text-zinc-400"
                  )}>
                    {initials || <UserIcon size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-zinc-900 dark:text-white">{fullName}</h4>
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide",
                        role === 'admin' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                          role === 'istruttore' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                            "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      )}>
                        {role === 'admin' ? 'Amministratore' : role}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                      <span className="flex items-center gap-1"><Mail size={12} /> {user.email}</span>
                      <span className="flex items-center gap-1"><Key size={12} /> ID: {user.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
        istruttore: a.istruttori,
        istruttore_id: a.istruttore_id,
        ora_inizio: format(new Date(a.data), 'HH:mm'),
      }));
      setImpegni(mapped);
    }
    setLoading(false);
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Eliminare questo impegno?")) return;
    const result = await deleteAppointmentAction(id);
    if (result.success) {
      fetch();
    } else {
      alert(result.error || "Errore durante l'eliminazione.");
    }
  };

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
    <div className="space-y-4">
      {/* FILTRI */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-3xl shadow-sm">
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl w-full sm:w-fit">
          <button 
            onClick={() => setShowStorico(false)}
            className={cn(
              "flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              !showStorico ? "bg-white dark:bg-zinc-700 text-orange-600 shadow-sm" : "text-zinc-500"
            )}
          >
            In Programma
          </button>
          <button 
            onClick={() => setShowStorico(true)}
            className={cn(
              "flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              showStorico ? "bg-white dark:bg-zinc-700 text-orange-600 shadow-sm" : "text-zinc-500"
            )}
          >
            Storico
          </button>
        </div>

        <select 
          value={selectedIstruttoreId}
          onChange={(e) => setSelectedIstruttoreId(e.target.value)}
          className="w-full sm:w-[200px] bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl py-2 px-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="all">Tutti gli Istruttori</option>
          {istruttori.map(ist => (
            <option key={ist.id} value={ist.id}>{ist.cognome} {ist.nome}</option>
          ))}
        </select>
      </div>

      <div className="relative">
        {loading ? (
          <div className="py-20 flex items-center justify-center font-bold text-zinc-400">
            <Loader2 className="animate-spin text-orange-500 mr-2" size={24} /> Caricamento impegni...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-16 text-center">
            <Clock size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-400">
              {selectedIstruttoreId !== 'all' ? 'Nessun impegno trovato per questo istruttore.' : 'Nessun impegno trovato.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(i => (
            <div 
              key={i.id} 
              onClick={() => openEdit(i)}
              className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:bg-zinc-50 transition-all font-semibold"
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-zinc-100"
                  style={{ backgroundColor: `${i.istruttore?.colore || '#ccc'}15`, color: i.istruttore?.colore || '#ccc' }}
                >
                  <Clock size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {i.tipo}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-zinc-100 rounded-lg text-zinc-500">
                      {i.istruttore?.cognome} {i.istruttore?.nome}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-400">
                    <span>{new Date(i.data).toLocaleDateString('it-IT')}</span>
                    <span>{i.ora_inizio.slice(0, 5)}</span>
                    <span className="bg-blue-50 text-blue-600 px-1.5 rounded">{i.durata} min</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleClone(i); }} 
                  title="Copia come formato"
                  className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl"
                >
                  <Copy size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(i.id); }} 
                  title="Elimina"
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 size={16} />
                </button>
                <Pencil size={18} className="text-zinc-300 group-hover:text-emerald-500" />
              </div>
            </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Modifica Impegno">
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
type GestioneTab = 'veicoli' | 'istruttori' | 'patenti' | 'utenti' | 'impegni';

const TABS: { id: GestioneTab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'veicoli', label: 'Veicoli', icon: Car, color: 'emerald' },
  { id: 'istruttori', label: 'Istruttori', icon: Users, color: 'blue' },
  { id: 'impegni', label: 'Altri Impegni', icon: Clock, color: 'orange' },
  { id: 'patenti', label: 'Patenti', icon: BadgeCheck, color: 'purple' },
  { id: 'utenti', label: 'Utenti', icon: ShieldCheck, color: 'indigo' },
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
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in pb-32">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Gestione</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Configura le risorse della scuola guida</p>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-2xl w-fit overflow-x-auto max-w-full">
          {TABS.map(tab => {
            const TIcon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-white dark:bg-zinc-800 shadow-sm' +
                    (tab.color === 'emerald' ? ' text-emerald-600 dark:text-emerald-400' :
                      tab.color === 'blue' ? ' text-blue-600 dark:text-blue-400' :
                        tab.color === 'purple' ? ' text-purple-600 dark:text-purple-400' :
                          ' text-indigo-600 dark:text-indigo-400')
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                )}
              >
                <TIcon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
        >
          <Plus size={18} />
          {getAddTitle()}
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {active === 'veicoli' && <TabVeicoli refreshKey={refreshKey} />}
        {active === 'istruttori' && <TabIstruttori refreshKey={refreshKey} />}
        {active === 'impegni' && <TabImpegni refreshKey={refreshKey} />}
        {active === 'patenti' && <TabPatenti refreshKey={refreshKey} />}
        {active === 'utenti' && <TabUtenti refreshKey={refreshKey} />}
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

      <div className="mt-12 border-t border-zinc-100 dark:border-zinc-800 pt-12">
        <SanityCheckButton />
      </div>
    </div>
  );
}
