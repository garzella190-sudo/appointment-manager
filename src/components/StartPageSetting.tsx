'use client';

import React, { useEffect, useState } from 'react';
import { CalendarDays, Home, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import {
  START_PAGE_STORAGE_KEY,
  START_PAGE_LABELS,
  leggiStartPage,
  type StartPage,
} from '@/lib/startPage';

/**
 * Scelta della PAGINA INIZIALE dell'app, salvata PER UTENTE.
 *
 * Usata sia nel pannello "I tuoi Permessi" della barra in basso (raggiungibile da
 * tutti, istruttori compresi) sia in Gestione → Impostazioni.
 *
 * La preferenza viene scritta nei metadata dell'account (`start_page`) così
 * l'utente la ritrova su ogni suo dispositivo; in parallelo resta una copia in
 * localStorage, che si applica subito anche se la rete manca.
 */
export function StartPageSetting({ className }: { className?: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [scelta, setScelta] = useState<StartPage>('calendar');
  const [salvataggio, setSalvataggio] = useState<StartPage | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setScelta(leggiStartPage(user));
    setPronto(true);
  }, [user]);

  const salva = async (valore: StartPage) => {
    if (valore === scelta) return;

    const precedente = scelta;
    setScelta(valore);
    setSalvataggio(valore);

    // 1. Questo dispositivo: effetto immediato
    try {
      localStorage.setItem(START_PAGE_STORAGE_KEY, valore);
    } catch {
      /* navigazione privata: si prosegue con il salvataggio sull'account */
    }

    // 2. Account dell'utente: vale su tutti i suoi dispositivi
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ data: { start_page: valore } });

      if (error) {
        setScelta(precedente);
        showToast('Impossibile salvare la preferenza. Riprova.', 'error');
        return;
      }

      showToast(`L'app si aprirà su ${START_PAGE_LABELS[valore]}`, 'success');
    } catch {
      // Offline: resta valida la scelta su questo dispositivo
      showToast(`L'app si aprirà su ${START_PAGE_LABELS[valore]} (solo su questo dispositivo)`, 'success');
    } finally {
      setSalvataggio(null);
    }
  };

  if (!pronto) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 size={18} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  const opzioni: { valore: StartPage; icona: React.ElementType }[] = [
    { valore: 'agenda', icona: Home },
    { valore: 'calendar', icona: CalendarDays },
  ];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="grid grid-cols-2 gap-2">
        {opzioni.map(({ valore, icona: Icona }) => {
          const attivo = scelta === valore;
          return (
            <button
              key={valore}
              type="button"
              onClick={() => salva(valore)}
              disabled={salvataggio !== null}
              className={cn(
                'h-20 rounded-2xl border-2 transition-all active:scale-95 flex flex-col items-center justify-center gap-1 disabled:opacity-60',
                attivo
                  ? 'bg-sky-50 dark:bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
              )}
            >
              <span className="flex items-center gap-1.5">
                <Icona size={16} strokeWidth={attivo ? 2.5 : 2} />
                {salvataggio === valore
                  ? <Loader2 size={12} className="animate-spin" />
                  : attivo && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest">
                {START_PAGE_LABELS[valore]}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-zinc-400 font-bold ml-1 leading-tight">
        Pagina che si apre all&apos;avvio dell&apos;app. Home e Calendario restano raggiungibili
        in qualsiasi momento dalla barra in basso.
      </p>
    </div>
  );
}

export default StartPageSetting;
