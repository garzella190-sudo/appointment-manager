/**
 * DATE E ORARI SEMPRE IN ORA ITALIANA.
 *
 * Il server (Vercel) gira in UTC: usando `format()` di date-fns lì, una guida alle
 * 21:15 italiane veniva scritta "20:15" nelle notifiche e nelle mail, e un impegno
 * a mezzanotte poteva perfino cambiare giorno.
 *
 * Qui si formatta con `Intl.DateTimeFormat` fissando `timeZone: 'Europe/Rome'`:
 * l'ora mostrata è sempre quella del muro di casa, con l'ora legale gestita da solo
 * (CET/CEST) senza tabelle da mantenere.
 *
 * Da usare in tutto il codice lato server che mostra un ISTANTE (timestamp).
 * Le date pure ('YYYY-MM-DD') si possono formattare normalmente: non hanno orario.
 */
const TZ = 'Europe/Rome';

function pezzo(data: Date, opzioni: Intl.DateTimeFormatOptions): string {
  // it-IT aggiunge il punto alle abbreviazioni ("mar.", "nov."): si toglie
  return new Intl.DateTimeFormat('it-IT', { timeZone: TZ, ...opzioni })
    .format(data)
    .replace(/\./g, '')
    .trim();
}

function istante(valore: string | Date | null | undefined): Date | null {
  if (!valore) return null;
  const data = valore instanceof Date ? valore : new Date(valore);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** "21:15" (ora italiana) */
export function oraItalia(valore: string | Date | null | undefined): string {
  const data = istante(valore);
  if (!data) return '';
  return pezzo(data, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "mar 17 nov alle 21:15" (ora italiana) */
export function dataOraBreveItalia(valore: string | Date | null | undefined): string {
  const data = istante(valore);
  if (!data) return '';
  const giorno = pezzo(data, { weekday: 'short' });
  const mese = pezzo(data, { day: 'numeric', month: 'short' });
  return `${giorno} ${mese} alle ${oraItalia(data)}`;
}

/** "martedì 17 novembre alle 21:15" (ora italiana) */
export function dataOraLungaItalia(valore: string | Date | null | undefined): string {
  const data = istante(valore);
  if (!data) return '';
  const giorno = pezzo(data, { weekday: 'long' });
  const mese = pezzo(data, { day: 'numeric', month: 'long' });
  return `${giorno} ${mese} alle ${oraItalia(data)}`;
}

/** "17 novembre" (ora italiana) */
export function dataLungaItalia(valore: string | Date | null | undefined): string {
  const data = istante(valore);
  if (!data) return '';
  return pezzo(data, { day: 'numeric', month: 'long' });
}

/** "17 nov" (ora italiana) */
export function dataBreveItalia(valore: string | Date | null | undefined): string {
  const data = istante(valore);
  if (!data) return '';
  return pezzo(data, { day: 'numeric', month: 'short' });
}

/**
 * "2026-11-17" — la DATA del calendario italiano.
 * Serve dove prima si faceva `timestamp.split('T')[0]`: quello prende la data UTC,
 * quindi una guida alle 00:30 italiane del 18 risultava del 17.
 */
export function dataItaliaISO(valore: string | Date | null | undefined): string {
  const data = istante(valore);
  if (!data) return '';
  const parti = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(data);
  return parti; // en-CA produce già YYYY-MM-DD
}

/** "17/11/2026" (data italiana) */
export function dataItaliaNumerica(valore: string | Date | null | undefined): string {
  const data = istante(valore);
  if (!data) return '';
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(data);
}

/** "17/11" (giorno e mese, ora italiana) */
export function giornoMeseItalia(valore: string | Date | null | undefined): string {
  const data = istante(valore);
  if (!data) return '';
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit'
  }).format(data);
}
