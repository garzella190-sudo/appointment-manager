'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { START_PAGE_PATHS, leggiStartPage } from '@/lib/startPage';

/** Le uniche pagine "selezionabili" come pagina iniziale */
const PAGINE_INIZIALI = ['/', '/calendar'];

/**
 * Porta l'utente sulla SUA pagina iniziale quando apre l'app.
 *
 * - Si applica UNA SOLA VOLTA per apertura: dopo, i tasti Home (agenda) e
 *   Calendario funzionano normalmente e non vengono rimbalzati indietro.
 * - La preferenza è per utente (`user_metadata.start_page`, vedi lib/startPage.ts)
 *   e si imposta da "I tuoi Permessi" (barra in basso) o da Gestione → Impostazioni.
 * - Default per tutti: CALENDARIO.
 */
export default function StartPageRouter() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const applicato = useRef(false);

  useEffect(() => {
    if (applicato.current || loading || !user) return;
    // Login, Clienti, Gestione…: non sono pagine iniziali, non si tocca nulla
    if (!PAGINE_INIZIALI.includes(pathname)) return;

    applicato.current = true;

    const destinazione = START_PAGE_PATHS[leggiStartPage(user)];
    if (destinazione !== pathname) {
      router.replace(destinazione);
    }
  }, [loading, user, pathname, router]);

  return null;
}
