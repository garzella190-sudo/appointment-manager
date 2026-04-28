'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { AlertCircle, Trash2, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { discardConflictAction, forceResolveConflictAction } from '@/actions/conflitti';
import { useToast } from '@/hooks/useToast';

export function ConflictRow({ conflict }: { conflict: any }) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleDiscard = async () => {
    setLoading(true);
    const res = await discardConflictAction(conflict.id);
    if (res.success) {
      showToast('Modifica scartata', 'info');
    } else {
      showToast(res.error || 'Errore', 'error');
      setLoading(false);
    }
  };

  const handleForce = async () => {
    if (!window.confirm('Forzare sovrascriverà eventuali blocchi. Sei sicuro?')) return;
    setLoading(true);
    const res = await forceResolveConflictAction(conflict.id);
    if (res.success) {
      showToast('Modifica forzata con successo', 'success');
    } else {
      showToast(res.error || 'Errore durante la forzatura', 'error');
      setLoading(false);
    }
  };

  const p = conflict.payload;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-[24px] p-4 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
      
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
              {conflict.entity_type} / {conflict.action}
            </span>
            <span className="text-xs text-zinc-400 font-medium">
              {format(new Date(conflict.created_at), 'dd MMM HH:mm', { locale: it })}
            </span>
          </div>
          
          <h3 className="font-bold text-lg mb-2">
            Dettagli della modifica tentata:
          </h3>
          
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl text-sm font-mono whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">
            {JSON.stringify(p, null, 2)}
          </div>
          
          <div className="mt-3 flex items-start gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-3 rounded-xl text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Motivo del blocco:</span>
              {conflict.conflict_reason}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0 sm:w-48">
          <button
            onClick={handleDiscard}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={16} /> Scarta</>}
          </button>
          
          <button
            onClick={handleForce}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-red-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-colors shadow-md shadow-red-500/20 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><ArrowRight size={16} /> Forza Modifica</>}
          </button>
        </div>
      </div>
    </div>
  );
}
