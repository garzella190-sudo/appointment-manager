/**
 * Preferenze di visualizzazione PERSONALI (per dispositivo), condivise fra Agenda e Calendario.
 *
 * Regole:
 * - si leggono una sola volta all'avvio e NON vengono mai resettate automaticamente;
 * - si riscrivono solo quando l'utente cambia qualcosa a mano;
 * - le chiavi sono le stesse per Agenda e Calendario, così la scelta fatta in una
 *   schermata (es. "agenda multi-istruttore") vale anche nell'altra.
 */
export const CHIAVI_VISTA = {
  /** Elenco JSON degli id istruttori selezionati (condiviso Agenda <-> Calendario). */
  istruttori: 'calendar_selectedInstructorIds',
  /** 1 | 3 | 5 | 7 giorni (solo Calendario). */
  giorni: 'calendar_viewDays',
  /** 'week' | 'resource' (solo Calendario). */
  modo: 'calendar_viewMode',
  /** true = la domenica NON si vede in calendario (il sabato resta sempre visibile). */
  domenica: 'calendar_nascondiDomenica',
  /** @deprecated vecchia preferenza "nascondi weekend" (sabato + domenica), letta solo per migrare. */
  weekend: 'calendar_showWeekends',
  granularita: 'calendar_granularity',
} as const;

/** Legge gli istruttori selezionati salvati. `null` = nessuna preferenza ancora impostata. */
export function leggiIstruttoriSelezionati(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CHIAVI_VISTA.istruttori);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return null;
  }
}

/** Salva la scelta personale degli istruttori (usata da Agenda e Calendario). */
export function salvaIstruttoriSelezionati(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHIAVI_VISTA.istruttori, JSON.stringify(ids));
  } catch {
    /* quota o modalità privata: la preferenza resta solo in memoria */
  }
}

/**
 * Se l'utente sta guardando PIÙ istruttori, anche il Calendario deve aprirsi in vista
 * multi-istruttore (colonne). Con 0/1 istruttore il Calendario tiene la propria scelta.
 */
export function sincronizzaModoIstruttori(ids: string[]): void {
  if (typeof window === 'undefined' || ids.length < 2) return;
  try {
    localStorage.setItem(CHIAVI_VISTA.modo, 'resource');
  } catch {
    /* ignore */
  }
}
