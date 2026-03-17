'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Cliente, Patente } from '@/lib/database.types';
import { Modal } from '@/components/Modal';
import { SchedaClienteForm } from '@/components/forms/SchedaClienteForm';
import { deleteClienteAction } from '@/actions/clienti';
import { Search, Plus, Phone, Mail, ChevronRight, Loader2, UserCircle2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhoneActions } from '@/components/PhoneActions';

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
      supabase.from('clienti').select('*').order('cognome').order('nome'),
      supabase.from('patenti').select('*').eq('nascosta', false).order('tipo'),
    ]);
    setClienti(cRes.data ?? []);
    setPatenti(pRes.data ?? []);
    setLoading(false);
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Sei sicuro di voler eliminare questo cliente? L'azione è irreversibile e cancellerà anche tutti i suoi appuntamenti.")) return;
    const result = await deleteClienteAction(id);
    if (result.success) {
      fetchData();
    } else {
      alert(result.error || "Errore durante l'eliminazione.");
    }
  };

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
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Clienti</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            {loading ? '...' : `${clienti.length} clienti registrati`}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          title="Nuovo Cliente"
          className="bg-purple-600 p-3 rounded-2xl text-white shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      </header>

      {/* Search */}
      <div className="relative mb-6 group">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-purple-500 transition-colors"
          size={20}
        />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per nome, telefono, email…"
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
        />
      </div>

      {/* List */}
      <div className="">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-zinc-400">
            <Loader2 className="animate-spin" size={40} />
            <p>Caricamento clienti…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-16 text-center">
            <UserCircle2 size={48} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-400">
              {search ? 'Nessun cliente trovato per questa ricerca.' : 'Nessun cliente ancora. Clicca il + per aggiungerne uno.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
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
                  className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl p-5 flex items-center justify-between group cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold text-lg flex items-center justify-center shrink-0">
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <h4 className="font-bold text-zinc-900 dark:text-white truncate">
                        {cliente.cognome} {cliente.nome}
                      </h4>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {cliente.telefono && (
                          <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                            <Phone size={11} />
                            {cliente.telefono}
                          </span>
                        )}
                        {cliente.telefono && <PhoneActions phone={cliente.telefono} secondary />}
                        {cliente.email && (
                          <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            <Mail size={11} />
                            {cliente.email}
                          </span>
                        )}
                        {patenteDisplay && (
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-bold uppercase tracking-wider">
                            Pat. {patenteDisplay}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(e, cliente.id); }}
                      className="p-2 rounded-xl text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                      title="Elimina cliente"
                    >
                      <Trash2 size={18} />
                    </button>
                    <ChevronRight
                      size={20}
                      className="text-zinc-300 group-hover:text-purple-500 transition-colors shrink-0"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Nuovo Cliente */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuovo Cliente">
        <SchedaClienteForm
          patenti={patenti}
          onSuccess={(id) => { setIsModalOpen(false); router.push(`/clienti/${id}`); }}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
