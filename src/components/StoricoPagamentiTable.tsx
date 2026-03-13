'use client';

import React from 'react';
import { AppuntamentoConDettagli, STATO_CONFIG, StatoAppuntamento } from '@/lib/database.types';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

interface StoricoPagamentiTableProps {
  appuntamenti: AppuntamentoConDettagli[];
}

const STATO_STYLE: Record<StatoAppuntamento, string> = {
  programmato: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800',
  completato:  'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 ring-1 ring-green-200 dark:ring-green-800',
  annullato:   'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800',
  no_show:     'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatEur = (n: number | null) =>
  n == null ? '—' : `€\u00a0${n.toFixed(2)}`;

export const StoricoPagamentiTable = ({ appuntamenti }: StoricoPagamentiTableProps) => {
  const totale = appuntamenti
    .filter(a => a.stato === 'completato' && a.importo != null)
    .reduce((sum, a) => sum + (a.importo ?? 0), 0);

  if (appuntamenti.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-400">
        <FileText size={40} strokeWidth={1.5} />
        <p className="text-sm font-medium">Nessun appuntamento registrato</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm border-collapse">
        {/* ── Head ──────────────────────────────────────────── */}
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
            {['Data', 'Stato', 'Istruttore', 'Importo', 'Note'].map(col => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Body ──────────────────────────────────────────── */}
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {appuntamenti.map((apt, i) => (
            <tr
              key={apt.id}
              className={cn(
                'group transition-colors duration-100',
                i % 2 === 0
                  ? 'bg-white dark:bg-zinc-950/20'
                  : 'bg-zinc-50/60 dark:bg-zinc-900/20',
                'hover:bg-blue-50/60 dark:hover:bg-blue-900/10'
              )}
            >
              {/* Data */}
              <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-zinc-600 dark:text-zinc-300">
                {formatDate(apt.data)}
              </td>

              {/* Stato */}
              <td className="px-4 py-3">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold',
                  STATO_STYLE[apt.stato]
                )}>
                  {STATO_CONFIG[apt.stato].label}
                </span>
              </td>

              {/* Istruttore */}
              <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300 font-medium">
                {apt.istruttore
                  ? `${apt.istruttore.nome} ${apt.istruttore.cognome}`
                  : <span className="text-zinc-400 italic">—</span>
                }
              </td>

              {/* Importo */}
              <td className={cn(
                'px-4 py-3 whitespace-nowrap font-semibold tabular-nums',
                apt.importo != null ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-400'
              )}>
                {formatEur(apt.importo)}
              </td>

              {/* Note */}
              <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-[200px] truncate" title={apt.note ?? ''}>
                {apt.note || <span className="italic text-zinc-300 dark:text-zinc-600">—</span>}
              </td>
            </tr>
          ))}
        </tbody>

        {/* ── Footer con totale ─────────────────────────────── */}
        <tfoot>
          <tr className="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60">
            <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 text-right">
              Totale incassato ({appuntamenti.filter(a => a.stato === 'completato').length} lezioni completate)
            </td>
            <td className="px-4 py-3 font-bold text-base text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">
              {formatEur(totale)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
