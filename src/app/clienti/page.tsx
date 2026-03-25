'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();
import { Cliente, Patente } from '@/lib/database.types';
import { Modal } from '@/components/Modal';
import { SchedaClienteForm } from '@/components/forms/SchedaClienteForm';
import { deleteClienteAction } from '@/actions/clienti';
import { Search, Plus, Phone, Mail, ChevronRight, Loader2, UserCircle2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhoneActions } from '@/components/PhoneActions';
import { ConfirmBubble } from '@/components/ConfirmBubble';
import { RefreshButton } from '@/components/RefreshButton';

export default function ClientiPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [patenti, setPatenti] = useState<Patente[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [cRes, pRes] = await Promise.all([
      supabase.from('clienti').select('*').is('eliminato_il', null).neq('nome', 'UFFICIO').order('cognome').order('nome'),
      supabase.from('patenti').select('*').is('eliminato_il', null).eq('nascosta', false).order('tipo'),
    ]);
    setClienti(cRes.data ?? []);
    setPatenti(pRes.data ?? []);
    setLoading(false);
  }, []);

  // handleDelete logic moved to ConfirmBubble trigger

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = clienti.filter(c => {
    const q = search.toLowerCase();
    return (
      c.nome.toLowerCase().includes(q) ||
      c.cognome.toLowerCase().includes(q) ||
      (c.telefono ?? '').includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  });

  const patenteLabel = (id: string | null) =>
    patenti.find(p => p.id === id)?.tipo ?? null;

  return (
    <div className="flex flex-col h-full animate-fade-in overflow-hidden">
      {/* Fixed Header & Search Section */}
      <div className="pt-2 px-4 md:px-6 pb-1 max-w-4xl mx-auto w-full flex-shrink-0">
        <header className="mb-2 flex items-end justify-between">
          <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Clienti</h1>
            <RefreshButton onRefresh={fetchData} className="h-8 w-8 p-0" />
          </div>
            <p className="text-zinc-500 dark:text-zinc-400 mt-0 text-xs font-semibold">
              {loading ? 'Caricamento...' : `${clienti.length} clienti registrati`}
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            title="Nuovo Cliente"
            className="bg-purple-600 p-3 rounded-2xl text-white shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-all shadow-purple-500/10"
          >
            <Plus size={24} />
          </button>
        </header>

        {/* Search Input Box */}
        <div className="relative group">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-purple-500 transition-colors"
            size={20}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome, telefono, email…"
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all shadow-sm text-sm"
          />
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto scroll-container px-4 md:px-6 pb-32">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4 text-zinc-400">
              <Loader2 className="animate-spin text-purple-500" size={40} />
              <p className="text-sm font-medium">Caricamento clienti…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-16 text-center shadow-sm">
              <UserCircle2 size={48} className="mx-auto mb-4 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
              <p className="text-zinc-500 font-medium">
                {search ? 'Nessun cliente trovato.' : 'Nessun cliente ancora registrato.'}
              </p>
              {!search && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="mt-4 text-purple-600 font-black text-xs uppercase tracking-widest hover:underline"
                >
                  Aggiungi il primo cliente
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map(cliente => {
                const patenteName = patenteLabel(cliente.patente_richiesta_id);
                const patenteDisplay = patenteName 
                  ? `${patenteName}${cliente.preferenza_cambio ? ` (${cliente.preferenza_cambio.charAt(0).toUpperCase() + cliente.preferenza_cambio.slice(1)})` : ''}` 
                  : null;
                const initials = `${cliente.nome[0] ?? ''}${cliente.cognome[0] ?? ''}`.toUpperCase();

                return (
                  <div 
                    key={cliente.id}
                    onClick={() => router.push(`/clienti/${cliente.id}`)}
                    className="bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/5 transition-all"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold text-lg flex items-center justify-center shrink-0 shadow-inner">
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-zinc-900 dark:text-white truncate">
                          {cliente.cognome} {cliente.nome}
                        </h4>
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 mt-1.5">
                          {cliente.telefono && (
                            <a 
                              href={`tel:${cliente.telefono.replace(/\D/g, '')}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-tighter hover:underline"
                            >
                              <Phone size={10} />
                              {cliente.telefono}
                            </a>
                          )}
                          {cliente.telefono && <PhoneActions phone={cliente.telefono} secondary />}
                          
                          {patenteDisplay && (
                            <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-md text-[10px] font-black uppercase tracking-wider">
                              Pat. {patenteDisplay}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <ConfirmBubble
                        title="Elimina Cliente"
                        message="Sei sicuro di voler eliminare questo cliente? I dati rimarranno nel database ma non saranno più visibili."
                        confirmLabel="Elimina"
                        onConfirm={async () => {
                          const result = await deleteClienteAction(cliente.id);
                          if (result.success) {
                            await fetchData();
                          } else {
                            alert(result.error || "Errore durante l'eliminazione.");
                          }
                        }}
                        trigger={
                          <button
                            className="p-2 rounded-xl text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all"
                            title="Elimina cliente"
                          >
                            <Trash2 size={18} />
                          </button>
                        }
                      />
                      <ChevronRight
                        size={20}
                        className="text-zinc-300 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all shrink-0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuovo Cliente">
        <SchedaClienteForm
          patenti={patenti}
          onSuccess={(id) => { setIsModalOpen(false); router.push(`/clienti/${id}`); fetchData(); }}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
