'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Modal } from '@/components/Modal';
import { Calendar, Users, ChevronRight, XCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toggleProntoEsameAction } from '@/actions/clienti';

const supabase = createClient();

interface AssignExamSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  onSuccess: () => void;
}

export function AssignExamSessionModal({ isOpen, onClose, clienteId, onSuccess }: AssignExamSessionModalProps) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const fetchSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sessioni_esame')
      .select('*')
      .gte('data', new Date().toISOString().split('T')[0])
      .order('data', { ascending: true });

    if (!error) {
      setSessions(data || []);
    }
    setLoading(false);
  };

  const handleAssign = async (sessionId: string | null) => {
    setIsSaving(true);
    const res = await toggleProntoEsameAction(clienteId, true, sessionId);
    setIsSaving(false);
    
    if (res.success) {
      onSuccess();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assegnazione Esame">
      <div className="space-y-6 pt-4">
        <div className="bg-sky-50 dark:bg-sky-500/10 p-4 rounded-2xl border border-sky-100 dark:border-sky-800/30">
          <p className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-widest mb-1 text-center">
            Vuoi assegnare l'allievo a una seduta già programmata?
          </p>
        </div>

        <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2 no-scrollbar">
          {loading ? (
            <div className="py-10 text-center animate-pulse">
               <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Caricamento sedute...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-8 text-center bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
               <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nessuna seduta programmata</p>
            </div>
          ) : sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => handleAssign(s.id)}
              disabled={isSaving}
              className="w-full flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl hover:border-sky-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition-colors">
                  <span className="text-[10px] font-black uppercase leading-none opacity-60">
                    {format(new Date(s.data), 'MMM', { locale: it })}
                  </span>
                  <span className="text-base font-black leading-none">
                    {format(new Date(s.data), 'dd')}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                    {s.nome || 'Seduta d\'Esame'}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    <Users size={12} />
                    <span>{s.n_candidati} Posti</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="text-zinc-300 group-hover:text-sky-500 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>

        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => handleAssign(null)}
            disabled={isSaving}
            className="w-full py-4 flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
          >
            <CheckCircle2 size={16} />
            Solo Pronto (Senza Seduta)
          </button>
        </div>

        <button
          onClick={onClose}
          disabled={isSaving}
          className="w-full py-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-[10px] font-black uppercase tracking-widest transition-all"
        >
          Annulla Operazione
        </button>
      </div>
    </Modal>
  );
}
