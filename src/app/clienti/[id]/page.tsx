'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Cliente, Patente, Istruttore, AppuntamentoConDettagli } from '@/lib/database.types';
import { StoricoPagamentiTable } from '@/components/StoricoPagamentiTable';
import {
  ArrowLeft, Phone, Mail, BadgeCheck, School, Loader2,
  Pencil, CheckCheck, History, Car,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhoneActions } from '@/components/PhoneActions';

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
    <div className="flex items-center gap-3 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-zinc-500 dark:text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</p>
        {href ? (
          <a href={href} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block">
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{value}</p>
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
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in">
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
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 truncate">
            {cliente.cognome} {cliente.nome}
          </h1>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-2">
            {cliente.telefono && (
              <a
                href={`tel:${cliente.telefono.replace(/\s/g, '')}`}
                className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-xs font-semibold hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
              >
                <Phone size={12} /> {cliente.telefono}
              </a>
            )}
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
        <button
          onClick={() => setEditMode(v => !v)}
          className={cn(
            'shrink-0 p-2.5 rounded-xl transition-all font-medium text-sm flex items-center gap-2',
            editMode
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
              : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          )}
        >
          {editMode ? <CheckCheck size={18} /> : <Pencil size={18} />}
        </button>
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
              const payloadNome = formState.nome.trim().split(/\\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
              const payloadCognome = formState.cognome.trim().split(/\\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
              const payloadEmail = formState.email ? formState.email.trim().toLowerCase() : null;

              const { error } = await supabase.from('clienti').update({
                nome: payloadNome,
                cognome: payloadCognome,
                telefono: formState.telefono?.trim() || null,
                email: payloadEmail,
                patente_richiesta_id: formState.patente_richiesta_id || null,
                preferenza_cambio: formState.preferenza_cambio || null,
              }).eq('id', cliente.id);
              
              if (!error) {
                await handleSave(cliente.id);
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
                  <label htmlFor="patente" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Patente Richiesta</label>
                  <select id="patente" value={formState.patente_richiesta_id} title="Seleziona Patente" onChange={(e) => setFormState(p => ({ ...p, patente_richiesta_id: e.target.value }))} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm">
                    {patenti.map(p => <option key={p.id} value={p.id}>{p.nome_visualizzato || p.tipo}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cambio" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Tipo Cambio</label>
                  <select id="cambio" value={formState.preferenza_cambio} title="Seleziona Tipo Cambio" onChange={(e) => setFormState(p => ({ ...p, preferenza_cambio: e.target.value }))} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm">
                    <option value="manuale">Manuale</option>
                    <option value="automatico">Automatico</option>
                  </select>
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
              <InfoRow icon={Phone}      label="Telefono" value={cliente.telefono} href={cliente.telefono ? `tel:${cliente.telefono.replace(/\s/g,'')}` : undefined} />
              <InfoRow icon={BadgeCheck} label="Patente richiesta" value={patente ? (patente.nome_visualizzato || patente.tipo) : 'Nessuna'} />
              <InfoRow icon={Car}        label="Preferenza Cambio" value={cliente.preferenza_cambio ? (cliente.preferenza_cambio.charAt(0).toUpperCase() + cliente.preferenza_cambio.slice(1)) : 'Indifferente'} />

              {/* Istruttori abilitati */}
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
                  <School size={13} />
                  Istruttori abilitati per questa patente ({istruttoriFiltrati.length})
                </p>
                {istruttoriFiltrati.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic">Nessun istruttore abilitato per questa patente.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {istruttoriFiltrati.map(i => (
                      <span
                        key={i.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                          {i.nome[0]}{i.cognome[0]}
                        </span>
                        {i.nome} {i.cognome}
                      </span>
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
  );
}
