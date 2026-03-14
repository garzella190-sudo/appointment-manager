'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Veicolo, Patente, Istruttore, TipoPatente, CambioAmmesso } from '@/lib/database.types';
import { Modal } from '@/components/Modal';
import { VeicoloForm } from '@/components/forms/VeicoloForm';
import { IstruttoreForm } from '@/components/forms/IstruttoreForm';
import { UserForm } from '@/components/forms/UserForm';
import { PatenteForm } from '@/components/forms/PatenteForm';
import { listUsersAction } from '@/actions/auth';
import { useRevisionReminder } from '@/hooks/useRevisionReminder';
import {
  AlertTriangle, CheckCircle2, CalendarClock, Phone, Mail,
  School, Clock, ChevronDown, ChevronUp, ClipboardList, EyeOff, Eye,
  Car, BadgeCheck, Users, Plus, Pencil, Loader2, ShieldCheck, UserPlus, Key, User as UserIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { User as AuthUser } from '@supabase/supabase-js';
import { PhoneActions } from '@/components/PhoneActions';

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

// ── Card singola veicolo (componente separato per rispettare le regole hooks) ──
const VeicoloCard = ({
  veicolo,
  onEdit,
}: {
  veicolo: Veicolo;
  onEdit: (v: Veicolo) => void;
}) => {
  const { calendarUrl } = useRevisionReminder(veicolo.data_revisione);
  return (
    <div className="glass-card p-5 flex items-center justify-between group">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <Car size={26} strokeWidth={1.5} />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-50">{veicolo.nome}</h4>
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md tracking-widest">
              {veicolo.targa}
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-2 mt-1.5">
            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-bold uppercase tracking-wide">
              Pat. {veicolo.tipo_patente}
            </span>
            <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md text-[10px] font-bold">
              {veicolo.cambio_manuale ? 'Manuale' : 'Automatico'}
            </span>
            <RevisionBadge dataRevisione={veicolo.data_revisione} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {calendarUrl && (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Aggiungi reminder revisione al calendario"
            className="p-2 rounded-xl text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
          >
            <CalendarClock size={18} />
          </a>
        )}
        <button
          onClick={() => onEdit(veicolo)}
          className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 transition-colors"
        >
          <Pencil size={16} />
        </button>
      </div>
    </div>
  );
};

// ── Tab: Veicoli ──────────────────────────────────────────────
const TabVeicoli = ({ refreshKey }: { refreshKey: number }) => {
  const [loading, setLoading] = useState(true);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Veicolo | null>(null);

  const fetchVeicoli = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('veicoli').select('*').order('nome');
    setVeicoli(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchVeicoli(); }, [fetchVeicoli, refreshKey]);

  const openEdit = (v: Veicolo) => { setEditing(v); setModalOpen(true); };
  const onSuccess = () => { setModalOpen(false); fetchVeicoli(); };

  return (
    <div className="relative">
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-500" size={36} />
        </div>
      ) : veicoli.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Car size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
          <p className="text-zinc-400">Nessun veicolo registrato. Clicca <strong>+</strong> per aggiungerne uno.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {veicoli.map(v => (
            <VeicoloCard key={v.id} veicolo={v} onEdit={openEdit} />
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifica Veicolo' : 'Nuovo Veicolo'}
      >
        <VeicoloForm
          veicoloId={editing?.id}
          defaultValues={editing ? {
            nome: editing.nome,
            targa: editing.targa,
            data_revisione: editing.data_revisione,
            tipo_patente: editing.tipo_patente,
            cambio_manuale: editing.cambio_manuale,
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
  const [istruttori, setIstruttori] = useState<Istruttore[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Istruttore | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('istruttori').select('*').order('cognome');
    setIstruttori(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch, refreshKey]);

  const openEdit = (i: Istruttore) => { setEditing(i); setModalOpen(true); };
  const onSuccess = () => { setModalOpen(false); fetch(); };

  return (
    <div className="relative">
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={36} />
        </div>
      ) : istruttori.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Users size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
          <p className="text-zinc-400">Nessun istruttore. Clicca <strong>+</strong> per aggiungerne uno.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {istruttori.map(i => {
            const initials = `${i.nome[0] ?? ''}${i.cognome[0] ?? ''}`.toUpperCase();
            return (
              <div key={i.id} className="glass-card p-5 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold text-xl flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-50">{i.cognome} {i.nome}</h4>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {i.telefono && (
                        <a href={`tel:${i.telefono}`} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-green-600 transition-colors">
                          <Phone size={11} /> {i.telefono}
                        </a>
                      )}
                      {i.telefono && <PhoneActions phone={i.telefono} secondary />}
                      {i.telefono && i.email && <span className="text-zinc-300">·</span>}
                      {i.email && (
                        <a href={`mailto:${i.email}`} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-blue-600 transition-colors">
                          <Mail size={11} /> {i.email}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(i.patenti_abilitate as TipoPatente[]).map(p => (
                        <span key={p} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-[10px] font-bold">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openEdit(i)}
                  className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Pencil size={16} />
                </button>
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
          istruttoreId={editing?.id}
          defaultValues={editing ? {
            nome: editing.nome,
            cognome: editing.cognome,
            telefono: editing.telefono ?? '',
            email: editing.email ?? '',
            patenti_abilitate: editing.patenti_abilitate as TipoPatente[],
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
  veicoli,
  isOpen,
  onToggle,
  onSave,
  onAddVehicle,
}: {
  pat: Patente;
  veicoli: Veicolo[];
  isOpen: boolean;
  onToggle: () => void;
  onSave: (tipo: TipoPatente, data: { nome: string; durata: number; cambio: CambioAmmesso; veicoli: string[]; nascosta?: boolean }) => Promise<void>;
  onAddVehicle: (tipo: TipoPatente) => void;
}) => {
  const [saving, setSaving] = useState(false);
  const isMoto = ['AM', 'A1', 'A2', 'A'].includes(pat.tipo);

  const [edit, setEdit] = useState<{
    nome: string;
    durata: number | '';
    cambio: CambioAmmesso;
    veicoli: string[];
    nascosta: boolean;
  }>({
    nome: pat.nome_visualizzato || `Patente ${pat.tipo}`,
    durata: pat.durata_default,
    cambio: pat.cambio_ammesso || (isMoto ? 'entrambi' : 'manuale'),
    veicoli: pat.veicoli_abilitati || [],
    nascosta: pat.nascosta || false,
  });

  // Sync internal state when pat changes from database
  useEffect(() => {
    setEdit({
      nome: pat.nome_visualizzato || `Patente ${pat.tipo}`,
      durata: pat.durata_default,
      cambio: pat.cambio_ammesso || (isMoto ? 'entrambi' : 'manuale'),
      veicoli: pat.veicoli_abilitati || [],
      nascosta: pat.nascosta || false,
    });
  }, [pat, isMoto]);

  const veicoliCompatibili = veicoli.filter(v => v.tipo_patente === pat.tipo);
  const c = CATEGORIA_COLOR[pat.tipo] ?? 'zinc';

  const handleSaveInternal = async () => {
    setSaving(true);
    const { durata, ...rest } = edit;
    await onSave(pat.tipo, {
      ...rest,
      durata: Number(durata) || 0
    });
    setSaving(false);
  };

  const toggleNascosta = async (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent card open
    setSaving(true);
    const nextNascosta = !edit.nascosta;
    setEdit(prev => ({ ...prev, nascosta: nextNascosta }));

    const { durata, ...rest } = edit;
    await onSave(pat.tipo, {
      ...rest,
      durata: Number(durata) || 0,
      nascosta: nextNascosta
    });
    setSaving(false);
  };

  const toggleVeicolo = (vId: string) => {
    setEdit(prev => ({
      ...prev,
      veicoli: prev.veicoli.includes(vId) ? prev.veicoli.filter(id => id !== vId) : [...prev.veicoli, vId],
    }));
  };

  return (
    <div className="glass-card overflow-hidden">
      <div
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 cursor-pointer"
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg bg-${c}-100 dark:bg-${c}-900/20 text-${c}-600 dark:text-${c}-400 opacity-${edit.nascosta ? '50' : '100'}`}>
            {pat.tipo}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-bold transition-colors ${edit.nascosta ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-900 dark:text-zinc-50'}`}>
                {edit.nome}
              </h3>
              {edit.nascosta && (
                <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-wide rounded-md">
                  Nascosta
                </span>
              )}
            </div>
            <div className={`flex items-center gap-3 mt-0.5 text-xs transition-colors ${edit.nascosta ? 'text-zinc-400/50 dark:text-zinc-600' : 'text-zinc-500'}`}>
              <span className="flex items-center gap-1"><Clock size={11} /> {edit.durata} min</span>
              <span className="flex items-center gap-1 font-medium capitalize">
                Cambio: {edit.cambio}
              </span>
              <span className="flex items-center gap-1"><Car size={11} /> {edit.veicoli.length} veicoli</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleNascosta}
            className={`p-2 rounded-xl transition-all font-bold ${edit.nascosta ? 'bg-red-50 text-red-500 border border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/30' : 'text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
            title={edit.nascosta ? "Mostra categoria" : "Nascondi categoria"}
          >
            {edit.nascosta ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          {isOpen ? <ChevronUp size={18} className="text-zinc-400" /> : <ChevronDown size={18} className="text-zinc-400" />}
        </div>
      </div>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-zinc-100 dark:border-zinc-800 pt-5 space-y-6 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-5">
            {/* Nome Visualizzato */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Nome Visualizzato</label>
              <input
                type="text"
                value={edit.nome}
                onChange={e => setEdit(prev => ({ ...prev, nome: e.target.value }))}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
              />
            </div>

            {/* Cambio Ammesso */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Tipo Cambio Ammesso</label>
              <select
                value={edit.cambio}
                onChange={e => setEdit(prev => ({ ...prev, cambio: e.target.value as CambioAmmesso }))}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-purple-500/20 text-sm"
              >
                <option value="manuale">Manuale</option>
                <option value="automatico">Automatico</option>
                <option value="entrambi">Entrambi (M / A)</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Durata default */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
                <Clock size={12} /> Durata Appuntamento (min)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={15}
                  max={240}
                  step={5}
                  value={edit.durata}
                  onChange={e => setEdit(prev => ({ ...prev, durata: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-24 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-mono font-bold"
                />
                <span className="text-xs text-zinc-400">minuti</span>
              </div>
            </div>

            {/* Veicoli abilitati */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Car size={12} /> Veicoli Abilitati
                </label>
                <button
                  onClick={() => onAddVehicle(pat.tipo)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors"
                >
                  <Plus size={12} /> Nuovo Veicolo
                </button>
              </div>

              {veicoliCompatibili.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                  <p className="text-[11px] text-zinc-400 italic">
                    Nessun veicolo {pat.tipo}. Aggiungine uno per abilitarlo.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {veicoliCompatibili.map(v => {
                    const sel = edit.veicoli.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => toggleVeicolo(v.id)}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all',
                          sel
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-purple-400'
                        )}
                      >
                        {v.nome}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveInternal}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-xl font-bold text-xs hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
              Salva {pat.tipo}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tab: Patenti ──────────────────────────────────────────────
const TabPatenti = ({ refreshKey }: { refreshKey: number }) => {
  const [loading, setLoading] = useState(true);
  const [patenti, setPatenti] = useState<Patente[]>([]);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [expanded, setExpanded] = useState<TipoPatente | null>('B');
  const [mostraNascoste, setMostraNascoste] = useState(false);
  const [modalVeicoloOpen, setModalVeicoloOpen] = useState(false);
  const [preselectedTipo, setPreselectedTipo] = useState<TipoPatente | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [pRes, vRes] = await Promise.all([
      supabase.from('patenti').select('*').order('tipo'),
      supabase.from('veicoli').select('*').order('nome'),
    ]);
    setPatenti(pRes.data ?? []);
    setVeicoli(vRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  const handleSave = async (tipo: TipoPatente, data: any) => {
    const { error } = await supabase
      .from('patenti')
      .upsert({
        tipo: tipo,
        nome_visualizzato: data.nome,
        durata_default: data.durata,
        cambio_ammesso: data.cambio,
        veicoli_abilitati: data.veicoli,
        nascosta: data.nascosta,
      }, { onConflict: 'tipo' });

    if (error) alert(error.message);
    else await fetchData();
  };

  const handleAddVehicle = (tipo: TipoPatente) => {
    setPreselectedTipo(tipo);
    setModalVeicoloOpen(true);
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-500" size={36} />
      </div>
    );
  }

  // Assicurati che tutte le categorie richieste esistano nel database (o almeno nella visualizzazione)
  // Nota: Lo schema SQL inserisce già i record.
  const patentiFiltrate = CATEGORIE.map(tipo => {
    const isMoto = ['AM', 'A1', 'A2', 'A'].includes(tipo);
    return patenti.find(p => p.tipo === tipo) || {
      tipo,
      nome_visualizzato: `Patente ${tipo}`,
      durata_default: 60,
      cambio_ammesso: isMoto ? 'entrambi' : 'manuale',
      veicoli_abilitati: [],
      nascosta: false,
    } as any;
  });

  const patentiVisibili = patentiFiltrate.filter(p => !p.nascosta);
  const patentiNascosteCount = patentiFiltrate.length - patentiVisibili.length;

  return (
    <div className="space-y-6 pb-14">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Configura le {CATEGORIE.length} categorie della normativa vigente.
          </p>
        </div>
        {patentiNascosteCount > 0 && (
          <button
            onClick={() => setMostraNascoste(prev => !prev)}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
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
            veicoli={veicoli}
            isOpen={expanded === pat.tipo}
            onToggle={() => setExpanded(expanded === pat.tipo ? null : pat.tipo)}
            onSave={handleSave}
            onAddVehicle={handleAddVehicle}
          />
        ))}
      </div>

      <Modal
        isOpen={modalVeicoloOpen}
        onClose={() => setModalVeicoloOpen(false)}
        title="Aggiungi Veicolo"
      >
        <VeicoloForm
          defaultValues={preselectedTipo ? {
            nome: '',
            targa: '',
            data_revisione: '',
            tipo_patente: preselectedTipo,
            cambio_manuale: true
          } : undefined}
          onSuccess={() => { setModalVeicoloOpen(false); fetchData(); }}
          onCancel={() => setModalVeicoloOpen(false)}
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

  const onSuccess = () => {
    fetchUsers();
  };

  return (
    <div className="relative">
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={36} />
        </div>
      ) : users.length === 0 ? (
        <div className="glass-card p-16 text-center">
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
              <div key={user.id} className="glass-card p-5 flex items-center justify-between group">
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
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-50">{fullName}</h4>
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

// ── Page principale ───────────────────────────────────────────
type GestioneTab = 'veicoli' | 'istruttori' | 'patenti' | 'utenti';

const TABS: { id: GestioneTab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'veicoli', label: 'Veicoli', icon: Car, color: 'emerald' },
  { id: 'istruttori', label: 'Istruttori', icon: Users, color: 'blue' },
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
      case 'patenti': return 'Nuovo Impegno / Patente';
      case 'utenti': return 'Nuovo Utente';
      default: return 'Nuovo';
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in pb-32">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Gestione</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Configura le risorse della scuola guida</p>
      </header>

      {/* Tab selector & Add Button */}
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

      {/* Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {active === 'veicoli' && <TabVeicoli refreshKey={refreshKey} />}
        {active === 'istruttori' && <TabIstruttori refreshKey={refreshKey} />}
        {active === 'patenti' && <TabPatenti refreshKey={refreshKey} />}
        {active === 'utenti' && <TabUtenti refreshKey={refreshKey} />}
      </div>

      {/* Global Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={getAddTitle()}
      >
        {active === 'veicoli' && (
          <VeicoloForm onSuccess={handleAddSuccess} onCancel={() => setIsAddModalOpen(false)} />
        )}
        {active === 'istruttori' && (
          <IstruttoreForm onSuccess={handleAddSuccess} onCancel={() => setIsAddModalOpen(false)} />
        )}
        {active === 'patenti' && (
          <PatenteForm onSuccess={handleAddSuccess} onCancel={() => setIsAddModalOpen(false)} />
        )}
        {active === 'utenti' && (
          <UserForm onSuccess={handleAddSuccess} onCancel={() => setIsAddModalOpen(false)} />
        )}
      </Modal>
    </div>
  );
}
