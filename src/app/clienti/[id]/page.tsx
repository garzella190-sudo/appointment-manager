'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();
import { Cliente, Patente, Istruttore, AppuntamentoConDettagli } from '@/lib/database.types';
import { StoricoPagamentiTable } from '@/components/StoricoPagamentiTable';
import {
  ArrowLeft, Phone, Mail, BadgeCheck, School, Loader2,
  Pencil, CheckCheck, History, Car,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhoneActions } from '@/components/PhoneActions';
import Select from '@/components/forms/Select';

const VIEW_BLOCK_CLS = 'w-full bg-[#F4F4F4] dark:bg-zinc-900/50 rounded-[16px] px-4 flex items-center h-12 text-sm font-semibold text-zinc-900 dark:text-zinc-100 transition-all cursor-default overflow-hidden';
const LABEL_CLS = 'text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-2';

// ── Tipi interni ─────────────────────────────────────────────
type PageData = {
  cliente: Cliente;
  patenti: Patente[];
  istruttoriFiltrati: Istruttore[];
  storico: AppuntamentoConDettagli[];
};

// ── Helpers ──────────────────────────────────────────────────
const InfoRow = ({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
  href?: string;
}) => {
  if (!value) return null;
  return (
    <div className="space-y-1.5 mb-4">
      <label className={LABEL_CLS}>
        <Icon size={12} className="shrink-0" />
        {label}
      </label>
      <div className={VIEW_BLOCK_CLS}>
        {href ? (
          <a 
            href={href} 
            className={cn(
              "hover:underline truncate block",
              label.toLowerCase().includes('telefono') ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
            )}
          >
            {value}
          </a>
        ) : (
          <span className="truncate">{value}</span>
        )}
      </div>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────
export default function SchedaClientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'storico'>('info');
  
  const [formState, setFormState] = useState({
    nome: '',
    cognome: '',
    telefono: '',
    email: '',
    patente_richiesta_id: '',
    preferenza_cambio: '',
  });

  const hasChanges = pageData && (
    formState.nome !== pageData.cliente.nome ||
    formState.cognome !== pageData.cliente.cognome ||
    formState.telefono !== (pageData.cliente.telefono ?? '') ||
    formState.email !== (pageData.cliente.email ?? '') ||
    formState.patente_richiesta_id !== (pageData.cliente.patente_richiesta_id ?? '') ||
    formState.preferenza_cambio !== (pageData.cliente.preferenza_cambio ?? '')
  );

  const fetchData = useCallback(async () => {
    setLoading(true);

    // 1. Cliente + patenti in parallelo
    const [cRes, pRes] = await Promise.all([
      supabase.from('clienti').select('*').eq('id', id).single(),
      supabase.from('patenti').select('*').eq('nascosta', false).order('tipo'),
    ]);

    if (cRes.error || !cRes.data) {
      setLoading(false);
      return;
    }

    const cliente: Cliente = cRes.data;
    const patenti: Patente[] = pRes.data ?? [];

    // 2. trova il tipo della patente richiesta
    const patenteRichiesta = patenti.find(p => p.id === cliente.patente_richiesta_id);
    const tipoPatente = patenteRichiesta?.tipo ?? null;

    // 3a. istruttori abilitati per quella patente (filtro PostgreSQL array contains)
    const istrRes = tipoPatente
      ? await supabase
          .from('istruttori')
          .select('*')
          .contains('patenti_abilitate', [tipoPatente])
          .order('cognome')
      : await supabase.from('istruttori').select('*').order('cognome');

    // 3b. storico appuntamenti del cliente con join istruttore + veicolo
    const aptRes = await supabase
      .from('appuntamenti')
      .select('id, data, durata, stato, importo, note, istruttori(id, nome, cognome), veicoli(id, nome, targa)')
      .eq('cliente_id', id)
      .order('data', { ascending: false });

    // Normalizza il risultato Supabase (il join torna come oggetto, non array)
    const storico: AppuntamentoConDettagli[] = (aptRes.data ?? []).map((row: any) => ({
      id:        row.id,
      data:      row.data,
      durata:    row.durata,
      stato:     row.stato,
      importo:   row.importo,
      note:      row.note,
      istruttore: row.istruttori ?? null,
      veicolo:   row.veicoli ?? null,
    }));

    setPageData({
      cliente,
      patenti,
      istruttoriFiltrati: istrRes.data ?? [],
      storico,
    });
    setFormState({
      nome: cliente.nome,
      cognome: cliente.cognome,
      telefono: cliente.telefono ?? '',
      email: cliente.email ?? '',
      patente_richiesta_id: cliente.patente_richiesta_id ?? '',
      preferenza_cambio: cliente.preferenza_cambio ?? '',
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (newId: string) => {
    setSaving(false);
    setEditMode(false);
    await fetchData();
  };

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-500" size={40} />
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-zinc-400">
        <p>Cliente non trovato.</p>
        <button onClick={() => router.back()} className="text-blue-500 hover:underline text-sm">
          ← Torna indietro
        </button>
      </div>
    );
  }

  const { cliente, patenti, istruttoriFiltrati, storico } = pageData;
  const patente = patenti.find(p => p.id === cliente.patente_richiesta_id);
  const initials = `${cliente.cognome[0] ?? ''}${cliente.nome[0] ?? ''}`.toUpperCase();

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      <div className="flex-1 overflow-y-auto px-6 md:px-10 pb-32">
        <div className="max-w-4xl mx-auto py-10">
          {/* ── Back ─────────────────────────────────────────────── */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-6 transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Tutti i clienti
          </button>

          {/* ── Hero card ────────────────────────────────────────── */}
          <div className="glass-card p-6 mb-6 flex items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-400 to-purple-600 text-white font-bold text-3xl flex items-center justify-center shrink-0 shadow-lg shadow-purple-400/30">
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 truncate flex items-baseline gap-3">
                {cliente.cognome} {cliente.nome}
                {cliente.telefono && (
                  <a 
                    href={`tel:${cliente.telefono.replace(/\s/g, '')}`}
                    className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                  >
                    {cliente.telefono}
                  </a>
                )}
              </h1>

              {/* Quick links */}
              <div className="flex flex-wrap gap-2 mt-2">
                {cliente.telefono && <PhoneActions phone={cliente.telefono} secondary />}
                {cliente.email && (
                  <a
                    href={`mailto:${cliente.email}`}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    <Mail size={12} /> {cliente.email}
                  </a>
                )}
                {patente && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold uppercase tracking-wide">
                    <BadgeCheck size={12} /> Patente {patente.tipo}{cliente.preferenza_cambio === 'automatico' ? ' Cod 78' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Edit toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditMode(v => !v)}
                className={cn(
                  'w-12 h-12 rounded-2xl transition-all flex items-center justify-center shadow-sm border border-purple-100/50 dark:border-purple-900/30 active:scale-95',
                  editMode
                    ? 'bg-purple-600 text-white shadow-xl shadow-purple-500/30'
                    : 'bg-white dark:bg-zinc-800 text-purple-600 hover:bg-purple-50'
                )}
                title={editMode ? "Valida" : "Modifica"}
              >
                {editMode ? <CheckCheck size={20} /> : <Pencil size={20} />}
              </button>
            </div>
          </div>

          {/* ── Tabs ─────────────────────────────────────────────── */}
          <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-2xl mb-6 w-fit">
            {([
              { id: 'info',    label: 'Dati Cliente',  icon: School },
              { id: 'storico', label: `Storico (${storico.length})`, icon: History },
            ] as const).map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all',
                    active
                      ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Tab: Dati Cliente ─────────────────────────────────── */}
          {activeTab === 'info' && (
            <div className="glass-card p-6 animate-fade-in">
              {editMode ? (
                /* Form di modifica INLINE */
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setSaving(true);
                  const payloadNome = formState.nome.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                  const payloadCognome = formState.cognome.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                  const payloadEmail = formState.email ? formState.email.trim().toLowerCase() : null;
                  const payloadTelefono = formState.telefono?.trim() || null;

                  // Duplicate Check logic with safer array joining
                  const predicates = [`and(nome.eq."${payloadNome}",cognome.eq."${payloadCognome}")`];
                  if (payloadTelefono) predicates.push(`telefono.eq."${payloadTelefono}"`);
                  if (payloadEmail)    predicates.push(`email.eq."${payloadEmail}"`);

                  const { data: duplicates } = await supabase
                    .from('clienti')
                    .select('id')
                    .or(predicates.join(','))
                    .neq('id', cliente.id)
                    .limit(1);

                  if (duplicates && duplicates.length > 0) {
                    alert("Un altro cliente con lo stesso nome, telefono o email è già registrato.");
                    setSaving(false);
                    return;
                  }

                  const { error } = await supabase.from('clienti').update({
                    nome: payloadNome,
                    cognome: payloadCognome,
                    telefono: payloadTelefono,
                    email: payloadEmail,
                    patente_richiesta_id: formState.patente_richiesta_id || null,
                    preferenza_cambio: formState.preferenza_cambio || null,
                  }).eq('id', cliente.id);
                  
                  if (!error) {
                    await fetchData();
                    setSaving(false);
                    setEditMode(false);
                  } else {
                    alert(error.message);
                    setSaving(false);
                  }
                }} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="cognome" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Cognome</label>
                      <input id="cognome" required value={formState.cognome} title="Cognome" onChange={(e) => setFormState(p => ({ ...p, cognome: e.target.value }))} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="nome" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Nome</label>
                      <input id="nome" required value={formState.nome} title="Nome" onChange={(e) => setFormState(p => ({ ...p, nome: e.target.value }))} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="telefono" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Telefono (Opzionale)</label>
                    <input id="telefono" value={formState.telefono} title="Telefono" onChange={(e) => setFormState(p => ({ ...p, telefono: e.target.value }))} type="tel" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Email (Opzionale)</label>
                    <input id="email" value={formState.email} title="Email" onChange={(e) => setFormState(p => ({ ...p, email: e.target.value }))} type="email" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="patente" className={LABEL_CLS}>Patente Richiesta</label>
                      <Select
                        searchable={true}
                        options={patenti.map(p => ({ id: p.id, label: p.nome_visualizzato || p.tipo }))}
                        value={formState.patente_richiesta_id}
                        onChange={(val) => setFormState(p => ({ ...p, patente_richiesta_id: val }))}
                        placeholder="Seleziona Patente"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="cambio" className={LABEL_CLS}>Tipo Cambio</label>
                      <Select
                        options={[
                          { id: 'manuale', label: 'Meccanico (Manuale)' },
                          { id: 'automatico', label: 'Automatico' }
                        ]}
                        value={formState.preferenza_cambio}
                        onChange={(val) => setFormState(p => ({ ...p, preferenza_cambio: val }))}
                        placeholder="Seleziona Tipo Cambio"
                      />
                    </div>
                  </div>

                  {hasChanges && (
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => {
                          setFormState({
                            nome: cliente.nome,
                            cognome: cliente.cognome,
                            telefono: cliente.telefono ?? '',
                            email: cliente.email ?? '',
                            patente_richiesta_id: cliente.patente_richiesta_id ?? '',
                            preferenza_cambio: cliente.preferenza_cambio ?? '',
                          });
                          setEditMode(false);
                        }}
                        className="flex-1 py-3 rounded-xl font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm"
                      >
                        Annulla
                      </button>
                      <button
                        disabled={saving}
                        type="submit"
                        className="flex-1 py-3 rounded-xl font-semibold bg-purple-600 text-white shadow-lg shadow-purple-500/20 hover:bg-purple-700 transition-all flex items-center justify-center text-sm"
                      >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : 'Aggiorna anagrafica'}
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                /* Vista sola lettura */
                <div>
                  <InfoRow icon={Mail}       label="Email"   value={cliente.email}    href={cliente.email ? `mailto:${cliente.email}` : undefined} />
                  <InfoRow icon={BadgeCheck} label="Patente richiesta" value={patente ? (patente.nome_visualizzato || patente.tipo) : 'Nessuna'} />
                  <InfoRow icon={Car}        label="Preferenza Cambio" value={cliente.preferenza_cambio ? (cliente.preferenza_cambio.charAt(0).toUpperCase() + cliente.preferenza_cambio.slice(1)) : 'Indifferente'} />

                  {/* Istruttori abilitati */}
                  <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <p className={LABEL_CLS}>
                      <School size={13} strokeWidth={2.5} />
                      Istruttori abilitati per {patente?.tipo || 'questa patente'} ({istruttoriFiltrati.length})
                    </p>
                    {istruttoriFiltrati.length === 0 ? (
                      <div className={cn(VIEW_BLOCK_CLS, "italic text-zinc-400 justify-center")}>Nessun istruttore abilitato</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        {istruttoriFiltrati.map(i => (
                          <div
                            key={i.id}
                            className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm group hover:border-blue-500/30 transition-all"
                          >
                            <div 
                              className="w-10 h-10 rounded-xl text-white font-bold text-xs flex items-center justify-center shadow-lg"
                              style={{ backgroundColor: i.colore || '#3b82f6' }}
                            >
                              {i.nome[0]}{i.cognome[0]}
                            </div>
                            <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{i.nome} {i.cognome}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Storico ─────────────────────────────────────── */}
          {activeTab === 'storico' && (
            <div className="animate-fade-in">
              <StoricoPagamentiTable appuntamenti={storico} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
