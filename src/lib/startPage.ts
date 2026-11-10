/**
 * Pagina iniziale dell'app (preferenza PER UTENTE).
 *
 * Ogni utente sceglie da quale pagina si apre l'agenda: "Agenda" (home) oppure
 * "Calendario". La scelta viene salvata nei metadata del suo account
 * (`user_metadata.start_page`) così vale su tutti i suoi dispositivi, con una
 * copia in localStorage che rende il cambio immediato anche senza rete.
 *
 * Default: CALENDARIO.
 */
export type StartPage = 'agenda' | 'calendar';

export const START_PAGE_STORAGE_KEY = 'start_page';
export const START_PAGE_DEFAULT: StartPage = 'calendar';

/** Percorsi delle due pagine selezionabili */
export const START_PAGE_PATHS: Record<StartPage, string> = {
  agenda: '/',
  calendar: '/calendar',
};

/** Etichette mostrate nei tasti delle impostazioni */
export const START_PAGE_LABELS: Record<StartPage, string> = {
  agenda: 'Agenda',
  calendar: 'Calendario',
};

export function normalizzaStartPage(valore: unknown): StartPage | null {
  if (valore === 'agenda' || valore === 'calendar') return valore;
  return null;
}

/**
 * Preferenza effettiva: prima l'account (vale su tutti i device), poi questo
 * dispositivo, infine il default (calendario).
 */
export function leggiStartPage(utente?: { user_metadata?: Record<string, unknown> } | null): StartPage {
  const daAccount = normalizzaStartPage(utente?.user_metadata?.start_page);
  if (daAccount) return daAccount;

  if (typeof window !== 'undefined') {
    try {
      const daDispositivo = normalizzaStartPage(window.localStorage.getItem(START_PAGE_STORAGE_KEY));
      if (daDispositivo) return daDispositivo;
    } catch {
      /* localStorage non disponibile (navigazione privata): si usa il default */
    }
  }

  return START_PAGE_DEFAULT;
}
