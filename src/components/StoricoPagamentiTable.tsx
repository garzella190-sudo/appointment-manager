'use client';

import React from 'react';
import { AppuntamentoConDettagli } from '@/lib/database.types';
import { cn } from '@/lib/utils';
import { FileText, CalendarClock } from 'lucide-react';

interface StoricoPagamentiTableProps {
  appuntamenti: AppuntamentoConDettagli[];
}

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return {
    dayMonthYear: date.toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: date.toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit' }),
  };
};

const formatEur = (n: number | null) =>
  n == null ? '—' : `€\u00a0${n.toFixed(2)}`;

interface ComputedStatus {
  label: string;
  style: string;
  dot: string;
}

const getDynamicStatus = (apt: AppuntamentoConDettagli): ComputedStatus => {
  if (apt.stato === 'annullato') {
    return {
      label: 'Annullata',
      style: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20',
      dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
    };
  }

  const start = new Date(apt.data).getTime();
  const end = start + (apt.durata || 60) * 60000;
  const now = Date.now();

  if (now > end) {
    return {
      label: 'Svolta',
      style: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20',
      dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
    };
  } else {
    return {
      label: 'Programmata',
      style: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20',
      dot: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
    };
  }
};

export const StoricoPagamentiTable = ({ appuntamenti }: StoricoPagamentiTableProps) => {
  // Calcolo totale dinamico: consideriamo "incassate/svolte" le guide nel passato e non annullate
  const now = Date.now();
  const guideSvolte = appuntamenti.filter(a => {
    const end = new Date(a.data).getTime() + (a.durata || 60) * 60000;
    return a.stato !== 'annullato' && now > end;
  });
  
  const totale = guideSvolte.reduce((sum, a) => sum + (a.importo ?? 0), 0);

  if (appuntamenti.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white dark:bg-zinc-900/30 rounded-[24px] border border-zinc-100 dark:border-zinc-800">
        <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-300 dark:text-zinc-600">
          <CalendarClock size={32} strokeWidth={1.5} />
        </div>
        <p className="text-sm font-semibold text-zinc-400">Nessuna guida registrata in storico</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#121212] rounded-[24px] border border-zinc-200 dark:border-zinc-800/80 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          {/* ── Head ──────────────────────────────────────────── */}
          <thead>
            <tr className="bg-zinc-50/80 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800/50">
              {['Data e Ora', 'Stato Guida', 'Istruttore', 'Dettagli', 'Importo'].map(col => (
                <th
                  key={col}
                  className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 whitespace-nowrap first:pl-8 last:pr-8"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────────────── */}
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {appuntamenti.map((apt) => {
              const status = getDynamicStatus(apt);
              const dateInfo = formatDate(apt.data);
              
              return (
                <tr
                  key={apt.id}
                  className="group transition-colors duration-200 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30"
                >
                  {/* Data */}
                  <td className="px-6 py-5 whitespace-nowrap first:pl-8">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">{dateInfo.dayMonthYear}</span>
                      <span className="text-xs font-semibold tracking-wide text-zinc-400">{dateInfo.time} • {apt.durata || 60} min</span>
                    </div>
                  </td>

                  {/* Stato */}
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider',
                      status.style
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
                      {status.label}
                    </div>
                  </td>

                  {/* Istruttore */}
                  <td className="px-6 py-5 whitespace-nowrap">
                    {apt.istruttore ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                          {apt.istruttore.nome[0]}{apt.istruttore.cognome[0]}
                        </div>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {apt.istruttore.nome} {apt.istruttore.cognome}
                        </span>
                      </div>
                    ) : (
                      <span className="text-zinc-400 font-medium italic">—</span>
                    )}
                  </td>

                  {/* Note / Dettagli */}
                  <td className="px-6 py-5 max-w-[200px]">
                    {apt.note ? (
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate" title={apt.note}>
                        {apt.note}
                      </p>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600 font-medium italic">—</span>
                    )}
                  </td>

                  {/* Importo */}
                  <td className="px-6 py-5 whitespace-nowrap last:pr-8">
                    <span className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-bold tabular-nums',
                      apt.importo != null 
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' 
                        : 'text-zinc-400'
                    )}>
                      {formatEur(apt.importo)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer con totale ─────────────────────────────── */}
      <div className="bg-zinc-50/80 dark:bg-zinc-900/40 p-6 flex flex-col md:flex-row items-center justify-between border-t border-zinc-200 dark:border-zinc-800/80 gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          <FileText size={16} />
          {guideSvolte.length} guide svolte in totale
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Totale Incassato</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
            {formatEur(totale)}
          </span>
        </div>
      </div>
    </div>
  );
};
