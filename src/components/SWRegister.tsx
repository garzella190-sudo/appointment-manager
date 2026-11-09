'use client';

import { useEffect } from 'react';

/** File del service worker (cambiare nome forza il reinstallo) */
const SW_URL = '/sw-v12.js';
/** Controllo periodico mentre l'app resta aperta */
const INTERVALLO_MS = 30 * 60 * 1000;

/**
 * Registra il service worker e forza l'aggiornamento automatico all'apertura dell'app.
 *
 * Quando si apre l'app (anche sulla schermata di login, quindi senza sessione) il browser
 * rivalida il worker (`updateViaCache: 'none'` + header no-store lato server); se c'è una
 * versione nuova questa prende subito il controllo (`skipWaiting` + `clients.claim`) e la
 * pagina si ricarica da sola, così le modifiche deployate si vedono senza svuotare la cache.
 */
export default function SWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let intervallo: ReturnType<typeof setInterval> | undefined;
    let ricaricando = false;

    /** Attiva subito il worker in attesa */
    const attivaSubito = (worker?: ServiceWorker | null) => {
      worker?.postMessage({ type: 'SKIP_WAITING' });
    };

    /** Cerca aggiornamenti e attiva quello eventualmente pronto */
    const controllaAggiornamenti = () => {
      if (!registration) return;
      registration
        .update()
        .then(() => attivaSubito(registration?.waiting))
        .catch(() => {
          /* offline o rete instabile: si riproverà al prossimo avvio */
        });
    };

    const suVisibilita = () => {
      if (document.visibilityState === 'visible') controllaAggiornamenti();
    };

    const suControllerChange = () => {
      if (ricaricando) return;
      ricaricando = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', suControllerChange);

    navigator.serviceWorker
      .register(SW_URL, { updateViaCache: 'none' })
      .then((reg) => {
        registration = reg;

        // Controllo immediato all'apertura + uno di sicurezza dopo il primo render
        controllaAggiornamenti();
        setTimeout(controllaAggiornamenti, 3000);

        // Un nuovo worker installato prende subito il controllo (senza prompt)
        reg.addEventListener('updatefound', () => {
          const nuovo = reg.installing;
          nuovo?.addEventListener('statechange', () => {
            if (nuovo.state === 'installed' && navigator.serviceWorker.controller) {
              attivaSubito(nuovo);
            }
          });
        });

        intervallo = setInterval(controllaAggiornamenti, INTERVALLO_MS);
        document.addEventListener('visibilitychange', suVisibilita);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });

    return () => {
      if (intervallo) clearInterval(intervallo);
      document.removeEventListener('visibilitychange', suVisibilita);
      navigator.serviceWorker.removeEventListener('controllerchange', suControllerChange);
    };
  }, []);

  return null;
}
