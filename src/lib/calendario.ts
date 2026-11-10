import { createHmac } from 'crypto';

/**
 * Calendario nelle email: link "Aggiungi al calendario" e file .ics.
 *
 * Serve perché l'app non può scrivere nel calendario del destinatario: quello che può
 * fare è (1) dargli un tasto che aggiunge l'evento in un tocco (Google Calendar) e
 * (2) allegare/linkare un file .ics che iPhone, Outlook e gli altri calendari aprono
 * come invito. `METHOD:REQUEST` + `ATTENDEE` fanno sì che i client propongano
 * "Aggiungi al calendario" invece di trattarlo come un allegato qualunque.
 */

export const SEDE = {
  nome: 'Autoscuola Toscana Fauglia',
  indirizzo: 'Via Le Vallicelle, 4, 56043 Fauglia (PI)',
};

export const MITTENTE_CALENDARIO = 'notifiche@guide.autoscuolatoscanasnc.it';

export interface EventoCalendario {
  /** id dell'appuntamento: rende stabile lo UID (ri-spedire aggiorna, non duplica) */
  id: string;
  /** inizio ISO (UTC) */
  inizio: string;
  /** durata in minuti */
  durata: number;
  titolo: string;
  /** Descrizione libera (le righe vengono convertite in \n per l'ICS) */
  descrizione: string;
  emailCliente?: string | null;
  /** Versione dell'evento: 1+ per gli aggiornamenti, così il client sostituisce quello vecchio */
  sequenza?: number;
}

/** Date → `20261110T140000Z` (formato richiesto da ICS e da Google Calendar) */
export function formattaDataCalendario(data: Date): string {
  return data.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function fineEvento(evento: EventoCalendario): Date {
  const inizio = new Date(evento.inizio);
  return new Date(inizio.getTime() + (evento.durata || 60) * 60000);
}

/** Testo sicuro per i campi ICS (virgole, punti e virgola, a capo) */
function proteggi(valore: string): string {
  return String(valore || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Spezza le righe oltre 75 OTTOtti come richiede lo standard iCalendar.
 * Si contano i byte UTF-8 (non i caratteri) e si itera per code point, così un
 * nome con emoji o lettere accentate non viene mai spezzato a metà.
 */
function piega(riga: string): string {
  if (Buffer.byteLength(riga, 'utf8') <= 75) return riga;

  const pezzi: string[] = [];
  let corrente = '';
  let occupati = 0;

  for (const carattere of riga) {
    const byte = Buffer.byteLength(carattere, 'utf8');
    // Le continuazioni iniziano con uno spazio: 74 byte utili invece di 75
    const limite = pezzi.length === 0 ? 75 : 74;

    if (occupati + byte > limite) {
      pezzi.push(corrente);
      corrente = '';
      occupati = 0;
    }
    corrente += carattere;
    occupati += byte;
  }

  if (corrente) pezzi.push(corrente);
  return pezzi.join('\r\n ');
}

/**
 * Contenuto del file .ics.
 * `metodo: 'REQUEST'` = invito (il client propone di aggiungerlo al calendario);
 * `metodo: 'PUBLISH'` = semplice pubblicazione (alcuni client lo importano e basta).
 */
export function buildIcs(
  evento: EventoCalendario,
  metodo: 'REQUEST' | 'PUBLISH' = 'REQUEST'
): string {
  const inizio = new Date(evento.inizio);
  const fine = fineEvento(evento);

  const righe: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Autoscuola Toscana Fauglia//Agenda Guide//IT',
    'CALSCALE:GREGORIAN',
    `METHOD:${metodo}`,
    'BEGIN:VEVENT',
    `UID:apt-${evento.id}@guide.autoscuolatoscanasnc.it`,
    `DTSTAMP:${formattaDataCalendario(new Date())}`,
    `DTSTART:${formattaDataCalendario(inizio)}`,
    `DTEND:${formattaDataCalendario(fine)}`,
    `SUMMARY:${proteggi(evento.titolo)}`,
    `DESCRIPTION:${proteggi(evento.descrizione)}`,
    `LOCATION:${proteggi(`${SEDE.nome} - ${SEDE.indirizzo}`)}`,
    `ORGANIZER;CN=${proteggi(SEDE.nome)}:mailto:${MITTENTE_CALENDARIO}`,
  ];

  if (evento.emailCliente) {
    righe.push(
      `ATTENDEE;CN=${proteggi('Cliente')};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${evento.emailCliente}`
    );
  }

  righe.push(
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    `SEQUENCE:${Math.max(0, evento.sequenza ?? 0)}`,
    // Promemoria dentro il calendario del cliente: 2 ore e 1 giorno prima
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${proteggi(evento.titolo)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${proteggi(evento.titolo)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return righe.map(piega).join('\r\n');
}

/** Link che apre Google Calendar già compilato (un tocco e l'evento è salvato) */
export function urlGoogleCalendar(evento: EventoCalendario): string {
  const inizio = new Date(evento.inizio);
  const fine = fineEvento(evento);

  const parametri = new URLSearchParams({
    action: 'TEMPLATE',
    text: evento.titolo,
    dates: `${formattaDataCalendario(inizio)}/${formattaDataCalendario(fine)}`,
    details: evento.descrizione,
    location: `${SEDE.nome} - ${SEDE.indirizzo}`,
  });

  return `https://calendar.google.com/calendar/render?${parametri.toString()}`;
}

/** Link che apre Outlook 365 / Outlook.com già compilato */
export function urlOutlookCalendar(evento: EventoCalendario): string {
  const inizio = new Date(evento.inizio);
  const fine = fineEvento(evento);

  const parametri = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: evento.titolo,
    startdt: inizio.toISOString(),
    enddt: fine.toISOString(),
    body: evento.descrizione,
    location: `${SEDE.nome} - ${SEDE.indirizzo}`,
  });

  return `https://outlook.office.com/calendar/0/deeplink/compose?${parametri.toString()}`;
}

// ── Link .ics firmato (utilizzabile dal client di posta, senza login) ─────────

function segreto(): string {
  return (
    process.env.CALENDAR_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'agenda-guide-calendario'
  );
}

/** Firma HMAC dell'id appuntamento: permette di scaricare l'ics senza sessione */
export function firmaCalendario(appointmentId: string): string {
  return createHmac('sha256', segreto()).update(appointmentId).digest('hex').slice(0, 32);
}

export function verificaFirmaCalendario(appointmentId: string, firma: string | null): boolean {
  if (!firma) return false;
  const attesa = firmaCalendario(appointmentId);
  if (attesa.length !== firma.length) return false;
  // Confronto a tempo costante
  let differenza = 0;
  for (let i = 0; i < attesa.length; i++) differenza |= attesa.charCodeAt(i) ^ firma.charCodeAt(i);
  return differenza === 0;
}

/** Base URL pubblico dell'app (per i link dentro le email) */
export function baseUrlPubblica(): string {
  const esplicita = process.env.NEXT_PUBLIC_SITE_URL;
  if (esplicita) return esplicita.replace(/\/$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;

  return 'https://guide.autoscuolatoscanasnc.it';
}

/** URL del file .ics servito da `/api/calendar/ics` (firmato: nessun login) */
export function urlIcs(appointmentId: string): string {
  return `${baseUrlPubblica()}/api/calendar/ics?id=${encodeURIComponent(appointmentId)}&firma=${firmaCalendario(appointmentId)}`;
}

/** Titolo/descrizione standard dell'evento a partire dai dati della guida */
export function eventoGuida(params: {
  id: string;
  inizio: string;
  durata: number;
  cliente?: string | null;
  istruttore?: string | null;
  veicolo?: string | null;
  note?: string | null;
  emailCliente?: string | null;
  sequenza?: number;
}): EventoCalendario {
  const descrizione = [
    `Sede: ${SEDE.nome}`,
    `Indirizzo: ${SEDE.indirizzo}`,
    params.istruttore ? `Istruttore: ${params.istruttore}` : null,
    params.veicolo ? `Veicolo: ${params.veicolo}` : null,
    params.note ? `Note: ${params.note}` : null,
    'Per disdire le guide chiama in autoscuola oppure contatta il tuo istruttore.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: params.id,
    inizio: params.inizio,
    durata: params.durata,
    titolo: params.cliente ? `Guida — ${params.cliente}` : 'Lezione di Guida',
    descrizione,
    emailCliente: params.emailCliente ?? null,
    sequenza: params.sequenza ?? 0,
  };
}
