'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { Resend } from 'resend';
import { dataItaliaISO, dataLungaItalia, dataOraLungaItalia } from '@/lib/oraItalia';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  buildIcs,
  eventoGuida,
  urlGoogleCalendar,
  urlIcs,
  SEDE,
  type EventoCalendario,
} from '@/lib/calendario';

// Note: use the verified domain email
const SENDER = 'Autoscuola Toscana <notifiche@guide.autoscuolatoscanasnc.it>';

function getItalyTimeStr(dateString: string) {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateString));
}

/**
 * Generates a premium HTML template for emails
 */
 function getEmailTemplate({
  title,
  name,
  date,
  time,
  duration,
  instructor,
  vehicle,
  isReminder = false,
  isCancellation = false,
  isModification = false,
  aggiungiAlCalendario,
  testo,
  nascondiNota = false
}: {
  title: string;
  name: string;
  date: string;
  time: string;
  duration: number;
  instructor: string;
  vehicle: string;
  isReminder?: boolean;
  isCancellation?: boolean;
  isModification?: boolean;
  /** Link "aggiungi al calendario": assente nelle email di eliminazione */
  aggiungiAlCalendario?: { google: string; ics: string } | null;
  /** Testo centrale su misura: sostituisce la frase automatica */
  testo?: string;
  /** Nasconde la nota rossa sulle 24 ore e la riga "per disdire chiama..." */
  nascondiNota?: boolean;
}) {
  let accentColor = '#3b82f6'; // Blue
  if (isReminder) accentColor = '#3b82f6';
  else if (isCancellation) accentColor = '#ef4444'; // Red
  else if (isModification) accentColor = '#f59e0b'; // Amber
  else accentColor = '#10b981'; // Green
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background: #ffffff; border-radius: 24px; padding: 40px; border: 1px solid #f3f4f6; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: center; }
        .title { color: #6b7280; font-size: 18px; font-weight: 700; margin-bottom: 24px; text-align: center; }
        .subtitle { color: #111827; font-size: 20px; margin-bottom: 40px; text-align: center; white-space: pre-line; font-weight: 600; }
        .footer { text-align: center; margin-top: 40px; color: #9ca3af; font-size: 13px; }
        .disclaimer { color: #ef4444; font-size: 16px; font-weight: 700; text-align: center; line-height: 1.6; margin-bottom: 24px; }
        .contact-info { color: #6b7280; font-size: 16px; font-weight: 500; margin-top: 48px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="title" style="color: ${accentColor}">${title}</div>
          <div class="subtitle">
            ${testo ?? (isCancellation 
              ? `La tua guida del ${format(parseISO(`${date}T${time}`), "EEEE d MMMM 'alle' HH:mm", { locale: it })} è stata ELIMINATA`
              : isModification
                ? `La tua guida è stata MODIFICATA per il ${format(parseISO(`${date}T${time}`), "EEEE d MMMM 'alle' HH:mm", { locale: it })}\nDurata: ${duration} min`
                : isReminder
                  ? `Ricordati la guida per il giorno ${format(parseISO(date), 'dd/MM/yyyy')} alle ore ${time}\nDurata: ${duration} min`
                  : `La guida per il giorno ${format(parseISO(date), 'dd/MM/yyyy')} alle ore ${time} è stata prenotata correttamente\nDurata: ${duration} min`
            )}
          </div>

          ${
            !isCancellation && aggiungiAlCalendario
              ? `
          <div style="margin: 0 0 28px 0; text-align: center;">
            <a href="${aggiungiAlCalendario.google}" target="_blank" rel="noopener"
               style="display: inline-block; background-color: ${accentColor}; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 15px; padding: 14px 28px; border-radius: 14px;">
              Aggiungi al calendario
            </a>
            <div style="margin-top: 14px; font-size: 12px; color: #9ca3af; line-height: 1.7;">
              iPhone / Outlook / altri calendari:
              <a href="${aggiungiAlCalendario.ics}" target="_blank" rel="noopener" style="color: #6b7280; font-weight: 700; text-decoration: underline;">
                aggiungi con questo link
              </a>
              oppure apri l&apos;allegato <strong>guida.ics</strong>.
            </div>
          </div>
          `
              : ''
          }

          ${
            nascondiNota
              ? ''
              : `
          <div class="disclaimer">
            NB: le guide vanno disdette 24h prima, pena addebito dell'importo
          </div>
          <div class="contact-info">
            Per disdire le guide chiama in autoscuola oppure contatta il tuo istruttore<br>
            ${SEDE.nome} — ${SEDE.indirizzo}
          </div>
          `
          }
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Autoscuola Toscana Fauglia. Tutti i diritti riservati.
        </div>
      </div>
    </body>
    </html>
  `;
}

/** Riga appuntamento usata per costruire il calendario del cliente */
interface RigaGuidaEmail {
  id: string;
  data: string;
  durata: number;
  inizio: string | null;
  note?: string | null;
}

/** Riga cliente usata per costruire il calendario del cliente */
interface RigaClienteEmail {
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
}

/**
 * Dati comuni per il calendario del cliente: evento, allegato .ics e link
 * "Aggiungi al calendario" (Google) + link firmato per gli altri calendari.
 */
function calendarioGuida(
  apt: RigaGuidaEmail,
  cliente: RigaClienteEmail | null | undefined,
  instructorName: string,
  vehicleName: string,
  sequenza = 0
) {
  const evento: EventoCalendario = eventoGuida({
    id: apt.id,
    inizio: apt.inizio || apt.data,
    durata: apt.durata || 60,
    cliente: cliente ? `${cliente.cognome || ''} ${cliente.nome || ''}`.trim() : null,
    istruttore: instructorName,
    veicolo: vehicleName,
    note: apt.note ?? null,
    emailCliente: cliente?.email ?? null,
    sequenza,
  });

  return {
    evento,
    ics: buildIcs(evento),
    links: { google: urlGoogleCalendar(evento), ics: urlIcs(apt.id) },
  };
}

export async function sendConfirmationEmailAction(appointmentId: string, isModification = false) {
  const supabase = createAdminClient();

  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, data, durata, inizio, note,
      clienti ( nome, cognome, email ),
      istruttori ( nome, cognome ),
      veicoli ( nome, targa )
    `)
    .eq('id', appointmentId)
    .single();

  if (error || !apt) return { success: false, error: 'Dati appuntamento non trovati' };

  const cliente = Array.isArray(apt.clienti) ? apt.clienti[0] : apt.clienti;
  const istruttore = Array.isArray(apt.istruttori) ? apt.istruttori[0] : apt.istruttori;
  const veicolo = Array.isArray(apt.veicoli) ? apt.veicoli[0] : apt.veicoli;

  if (!cliente?.email) return { success: false, error: 'Email cliente mancante' };

  const clientName = `${cliente.nome}`;
  const instructorName = istruttore ? `${istruttore.nome} ${istruttore.cognome}` : 'Non assegnato';
  const vehicleName = veicolo ? `${veicolo.nome} (${veicolo.targa})` : 'Non assegnato';
  // Data ITALIANA: split('T')[0] prendeva la data UTC (una guida alle 00:30 finiva nel giorno prima)
  const dateStr = dataItaliaISO(apt.data);
  const timeStr = getItalyTimeStr(apt.inizio);

  // Allegato .ics + tasto "Aggiungi al calendario" (Google) + link per gli altri calendari.
  // `sequenza = 1` sulle modifiche: i calendari aggiornano l'evento esistente invece di
  // crearne un secondo.
  const calendario = calendarioGuida(apt, cliente, instructorName, vehicleName, isModification ? 1 : 0);

  try {
    const html = getEmailTemplate({
      title: isModification ? 'La tua guida è stata modificata' : 'Prenotazione effettuata',
      name: clientName,
      date: dateStr,
      time: timeStr,
      duration: apt.durata,
      instructor: instructorName,
      vehicle: vehicleName,
      isReminder: false,
      isModification: isModification,
      aggiungiAlCalendario: calendario.links
    });

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('RESEND_API_KEY is not defined in the environment variables');
      return { success: false, error: 'Configurazione email mancante (API Key)' };
    }

    const resend = new Resend(resendApiKey);
    const { data, error: resendError } = await resend.emails.send({
      from: SENDER,
      to: cliente.email,
      subject: `${isModification ? 'Guida Modificata' : 'Prenotazione effettuata'} - ${format(parseISO(dateStr), 'd MMMM', { locale: it })} alle ${timeStr}`,
      html,
      attachments: [
        {
          filename: 'guida.ics',
          content: Buffer.from(calendario.ics).toString('base64'),
          contentType: 'text/calendar'
        }
      ]
    });

    if (resendError) {
      console.error('Resend Error:', resendError);
      return { success: false, error: `Errore Resend: ${resendError.message}` };
    }

    console.log('Confirmation email sent successfully to:', cliente.email, 'Data:', data);
    return { success: true };
  } catch (error) {
    console.error('Errore imprevisto invio email:', error);
    return { success: false, error: 'Errore imprevisto durante l\'invio dell\'email' };
  }
}

/**
 * Promemoria al CLIENTE (email).
 *
 * UNA SOLA MAIL PER APPUNTAMENTO, anche se due giri di cron si sovrappongono:
 * prima di spedire la funzione PRENOTA l'invio con un aggiornamento atomico
 *     update appuntamenti set promemoria_email_inviato_il = adesso
 *     where id = X and promemoria_email_inviato_il is null
 * Solo chi riesce a scrivere il marcatore spedisce; chi arriva secondo non trova
 * più la riga da marcare e salta. Se l'invio fallisce, il marcatore viene rimesso
 * a NULL così un giro successivo può riprovare.
 */
export async function sendReminderEmailAction(appointmentId: string) {
  const supabase = createAdminClient();

  const colonneBase = `
      id, data, durata, inizio, note,
      clienti ( nome, cognome, email ),
      istruttori ( nome, cognome ),
      veicoli ( nome, targa )
    `;

  // Si prova a leggere anche il marcatore di invio; se la migrazione non è ancora
  // stata applicata si continua senza (comportamento precedente, nessun crash).
  let { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`${colonneBase}, promemoria_email_inviato_il`)
    .eq('id', appointmentId)
    .single();

  let colonnaMancante = Boolean(error && /promemoria_email_inviato_il/.test(error.message));
  if (colonnaMancante) {
    console.warn('Colonna promemoria_email_inviato_il assente: esegui la migrazione 20261110140000_promemoria.sql');
    ({ data: apt, error } = await supabase
      .from('appuntamenti')
      .select(colonneBase)
      .eq('id', appointmentId)
      .single());
  }

  if (error || !apt) return { success: false, error: 'Dati appuntamento non trovati' };

  // Già inviato → non si rispedisce (una sola mail per appuntamento)
  const promemoriaGiaInviato = (apt as { promemoria_email_inviato_il?: string | null }).promemoria_email_inviato_il;
  if (promemoriaGiaInviato) {
    console.log('Promemoria email già inviato il', promemoriaGiaInviato, 'per', appointmentId, '- salto');
    return { success: true, saltato: true };
  }

  // ── PRENOTAZIONE ATOMICA dell'invio ────────────────────────────────────────
  // Il controllo letto sopra non basta: fra la lettura e l'invio un altro giro di
  // cron può fare la stessa cosa (era la causa delle mail doppie). Qui si scrive il
  // marcatore *prima* di spedire, e solo chi lo scrive davvero ha il permesso di
  // inviare (UPDATE ... WHERE promemoria_email_inviato_il IS NULL).
  const marcatoAlle = new Date().toISOString();
  if (!colonnaMancante) {
    const { data: prenotato, error: errorePrenotazione } = await supabase
      .from('appuntamenti')
      .update({ promemoria_email_inviato_il: marcatoAlle })
      .eq('id', appointmentId)
      .is('promemoria_email_inviato_il', null)
      .select('id');

    if (errorePrenotazione && /promemoria_email_inviato_il/.test(errorePrenotazione.message)) {
      colonnaMancante = true;
    } else if (errorePrenotazione) {
      return { success: false, error: `Impossibile marcare il promemoria: ${errorePrenotazione.message}` };
    } else if (!prenotato || prenotato.length === 0) {
      // Un altro giro l'ha già prenotato: niente seconda mail
      console.log('Promemoria già in corso da un altro giro per', appointmentId, '- salto');
      return { success: true, saltato: true };
    }
  }

  /**
   * L'invio non è riuscito: si rimette il marcatore a NULL (solo se è ancora il nostro,
   * grazie al confronto sul timestamp) così un giro successivo può riprovare. Senza
   * questo, un errore temporaneo di Resend brucerebbe il promemoria per sempre.
   */
  const rilasciaPrenotazione = async () => {
    if (colonnaMancante) return;
    const { error: erroreRilascio } = await supabase
      .from('appuntamenti')
      .update({ promemoria_email_inviato_il: null })
      .eq('id', appointmentId)
      .eq('promemoria_email_inviato_il', marcatoAlle);

    if (erroreRilascio) console.error('Impossibile liberare il promemoria:', erroreRilascio.message);
  };

  const cliente = Array.isArray(apt.clienti) ? apt.clienti[0] : apt.clienti;
  const istruttore = Array.isArray(apt.istruttori) ? apt.istruttori[0] : apt.istruttori;
  const veicolo = Array.isArray(apt.veicoli) ? apt.veicoli[0] : apt.veicoli;

  if (!cliente?.email) return { success: false, error: 'Email cliente mancante' };

  const clientName = `${cliente.nome}`;
  const instructorName = istruttore ? `${istruttore.nome} ${istruttore.cognome}` : 'Non assegnato';
  const vehicleName = veicolo ? `${veicolo.nome} (${veicolo.targa})` : 'Non assegnato';
  // Data ITALIANA: split('T')[0] prendeva la data UTC (una guida alle 00:30 finiva nel giorno prima)
  const dateStr = dataItaliaISO(apt.data);
  const timeStr = getItalyTimeStr(apt.inizio);

  // Promemoria: stesso tasto "Aggiungi al calendario" (chi non l'ha aggiunta prima, la aggiunge ora)
  const calendario = calendarioGuida(apt, cliente, instructorName, vehicleName);

  try {
    const html = getEmailTemplate({
      title: 'Promemoria Guida Prenotata',
      name: clientName,
      date: dateStr,
      time: timeStr,
      duration: apt.durata,
      instructor: instructorName,
      vehicle: vehicleName,
      isReminder: true,
      aggiungiAlCalendario: calendario.links
    });

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('RESEND_API_KEY is not defined in the environment variables');
      await rilasciaPrenotazione();
      return { success: false, error: 'Configurazione email mancante (API Key)' };
    }

    const resend = new Resend(resendApiKey);
    const { data, error: resendError } = await resend.emails.send({
      from: SENDER,
      to: cliente.email,
      subject: 'Promemoria Guida Prenotata',
      html,
      attachments: [
        {
          filename: 'guida.ics',
          content: Buffer.from(calendario.ics).toString('base64'),
          contentType: 'text/calendar'
        }
      ]
    });

    if (resendError) {
      console.error('Resend Reminder Error:', resendError);
      await rilasciaPrenotazione();
      return { success: false, error: `Errore Resend Promemoria: ${resendError.message}` };
    }

    // Il marcatore è già stato scritto PRIMA dell'invio (prenotazione atomica):
    // da qui in poi nessun altro giro può rispedire questa email.
    console.log('Reminder email sent successfully to:', cliente.email, 'Data:', data);
    return { success: true };
  } catch (error) {
    console.error('Errore imprevisto invio promemoria:', error);
    await rilasciaPrenotazione();
    return { success: false, error: 'Errore imprevisto durante l\'invio del promemoria' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMEMORIA PROGRAMMATO (senza cron frequente)
// ─────────────────────────────────────────────────────────────────────────────
//
// Alla prenotazione partono due cose:
//   1) la mail di conferma, subito;
//   2) la mail di promemoria, PROGRAMMATA su Resend per "inizio guida − 24 ore".
//
// Così la precisione non dipende dal fatto che un cron giri spesso: Resend sa
// spedire all'istante richiesto. Il cron giornaliero resta solo come rete di
// sicurezza per gli appuntamenti rimasti senza programmazione.

/**
 * Preavviso del promemoria al cliente: 24 ore prima dell'orario della guida.
 * NB: non è esportata perché in un modulo `'use server'` si possono esportare solo
 * funzioni async; l'endpoint del cron ha la sua copia qui sotto.
 */
const ANTICIPO_PROMEMORIA_MS = 24 * 60 * 60 * 1000;

/** Resend accetta programmazioni fino a 30 giorni in avanti. */
const MASSIMO_PROGRAMMAZIONE_MS = 30 * 24 * 60 * 60 * 1000;

type ClienteEmail = { nome: string; cognome: string; email: string | null };
type IstruttoreEmail = { nome: string; cognome: string };
type VeicoloEmail = { nome: string; targa: string };
type AppuntamentoEmail = {
  id: string;
  data: string;
  durata: number;
  inizio: string | null;
  clienti?: ClienteEmail | ClienteEmail[] | null;
  istruttori?: IstruttoreEmail | IstruttoreEmail[] | null;
  veicoli?: VeicoloEmail | VeicoloEmail[] | null;
};

/**
 * Costruisce la mail di promemoria di una guida: identica sia per l'invio immediato
 * sia per quello programmato, così il testo non può divergere fra i due percorsi.
 */
function costruisciPromemoriaCliente(apt: AppuntamentoEmail):
  | { ok: false; error: string }
  | {
      ok: true;
      email: string;
      subject: string;
      html: string;
      attachments: { filename: string; content: string; contentType: string }[];
    } {
  const cliente = Array.isArray(apt.clienti) ? apt.clienti[0] : apt.clienti;
  const istruttore = Array.isArray(apt.istruttori) ? apt.istruttori[0] : apt.istruttori;
  const veicolo = Array.isArray(apt.veicoli) ? apt.veicoli[0] : apt.veicoli;

  if (!cliente?.email) return { ok: false, error: 'Email cliente mancante' };

  const instructorName = istruttore ? `${istruttore.nome} ${istruttore.cognome}` : 'Non assegnato';
  const vehicleName = veicolo ? `${veicolo.nome} (${veicolo.targa})` : 'Non assegnato';
  // Data ITALIANA: split('T')[0] prendeva la data UTC (una guida alle 00:30 finiva nel giorno prima)
  const dateStr = dataItaliaISO(apt.data);
  const timeStr = getItalyTimeStr(apt.inizio || apt.data);

  // Promemoria: stesso tasto "Aggiungi al calendario" (chi non l'ha aggiunta prima, la aggiunge ora)
  const calendario = calendarioGuida(apt, cliente, instructorName, vehicleName);

  const html = getEmailTemplate({
    title: 'Promemoria Guida Prenotata',
    name: cliente.nome,
    date: dateStr,
    time: timeStr,
    duration: apt.durata,
    instructor: instructorName,
    vehicle: vehicleName,
    isReminder: true,
    aggiungiAlCalendario: calendario.links
  });

  return {
    ok: true,
    email: cliente.email,
    subject: 'Promemoria Guida Prenotata',
    html,
    attachments: [
      {
        filename: 'guida.ics',
        content: Buffer.from(calendario.ics).toString('base64'),
        contentType: 'text/calendar'
      }
    ]
  };
}

/**
 * Programma la mail di promemoria 24 ore prima dell'orario della guida.
 * Da chiamare alla creazione dell'appuntamento e quando viene spostato.
 *
 * Casi:
 *  - guida già iniziata            → non si fa nulla;
 *  - guida fra meno di 24h         → la mail parte subito (il momento giusto è passato);
 *  - guida oltre 30 giorni         → Resend non può programmare: si segnala l'errore
 *                                    e ci penserà il cron giornaliero più avanti;
 *  - già programmata o già inviata → non si duplica.
 */
export async function programmaPromemoriaEmail(appointmentId: string) {
  const supabase = createAdminClient();

  const colonneBase = `
      id, data, durata, inizio, send_email,
      clienti ( nome, cognome, email ),
      istruttori ( nome, cognome ),
      veicoli ( nome, targa )
    `;

  let { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`${colonneBase}, promemoria_email_inviato_il, promemoria_email_id`)
    .eq('id', appointmentId)
    .maybeSingle();

  let colonneNuove = true;
  if (error && /promemoria_email_id|promemoria_email_inviato_il/.test(error.message)) {
    colonneNuove = false;
    console.warn('Colonne promemoria assenti: esegui la migrazione 20261113180000_promemoria_programmato.sql');
    ({ data: apt, error } = await supabase
      .from('appuntamenti')
      .select(colonneBase)
      .eq('id', appointmentId)
      .maybeSingle());
  }

  if (error || !apt) return { success: false, error: 'Appuntamento non trovato' };

  const riga = apt as unknown as AppuntamentoEmail & {
    send_email?: boolean | null;
    promemoria_email_inviato_il?: string | null;
    promemoria_email_id?: string | null;
  };

  if (!riga.send_email) return { success: true, saltato: true, motivo: 'cliente senza email attiva' };
  if (riga.promemoria_email_inviato_il) return { success: true, saltato: true, motivo: 'già inviato' };
  if (riga.promemoria_email_id) return { success: true, saltato: true, motivo: 'già programmato' };

  const preparata = costruisciPromemoriaCliente(riga);
  if (!preparata.ok) {
    // Cliente senza indirizzo email: non è un errore da segnalare né un controllo da
    // ripetere, semplicemente non c'è nulla da inviare. Si esce senza fare niente.
    return { success: true, saltato: true, motivo: 'cliente senza email' };
  }

  const inizio = new Date(riga.inizio || riga.data).getTime();
  if (Number.isNaN(inizio)) return { success: false, error: 'Orario della guida non valido' };

  const adesso = Date.now();
  if (inizio <= adesso) return { success: true, saltato: true, motivo: 'guida già iniziata' };

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('RESEND_API_KEY is not defined in the environment variables');
    return { success: false, error: 'Configurazione email mancante (API Key)' };
  }

  const resend = new Resend(resendApiKey);
  const quando = inizio - ANTICIPO_PROMEMORIA_MS;
  // Con meno di un minuto di anticipo non ha senso programmare: si spedisce subito.
  const mandareSubito = quando <= adesso + 60 * 1000;

  if (!mandareSubito && quando - adesso > MASSIMO_PROGRAMMAZIONE_MS) {
    console.warn(
      'Promemoria non programmato (oltre i 30 giorni consentiti da Resend):',
      new Date(inizio).toISOString()
    );
    return { success: false, error: 'Guida troppo lontana per programmare la mail (max 30 giorni)' };
  }

  /**
   * INVIO IMMEDIATO → PRENOTAZIONE ATOMICA.
   *
   * Era qui il difetto che ha mandato due volte il promemoria a un cliente: fra il
   * controllo "non ancora inviato" e l'invio, un altro giro (salvataggio della guida
   * o recupero manuale) poteva infilarsi e spedire anche lui. Ora il marcatore si
   * scrive PRIMA di spedire, con un update condizionato: chi arriva secondo salta.
   */
  if (mandareSubito) {
    const marca = new Date().toISOString();

    if (colonneNuove) {
      const { data: prenotato, error: errorePrenotazione } = await supabase
        .from('appuntamenti')
        .update({ promemoria_email_inviato_il: marca })
        .eq('id', appointmentId)
        .is('promemoria_email_inviato_il', null)
        .select('id');

      if (errorePrenotazione) {
        return { success: false, error: `Impossibile marcare il promemoria: ${errorePrenotazione.message}` };
      }
      if (!prenotato || prenotato.length === 0) {
        return { success: true, saltato: true, motivo: 'già inviato da un altro giro' };
      }
    }

    const { error: erroreInvio } = await resend.emails.send({
      from: SENDER,
      to: preparata.email,
      subject: preparata.subject,
      html: preparata.html,
      attachments: preparata.attachments
    });

    if (erroreInvio) {
      console.error('Resend Promemoria Error:', erroreInvio);
      // L'invio non è riuscito: si libera il marcatore così un giro successivo riprova
      if (colonneNuove) {
        await supabase
          .from('appuntamenti')
          .update({ promemoria_email_inviato_il: null })
          .eq('id', appointmentId)
          .eq('promemoria_email_inviato_il', marca);
      }
      return { success: false, error: `Errore Resend Promemoria: ${erroreInvio.message}` };
    }

    console.log('Promemoria inviato subito (guida entro 24 ore):', preparata.email);
    return { success: true, subito: true };
  }

  const { data: inviata, error: resendError } = await resend.emails.send({
    from: SENDER,
    to: preparata.email,
    subject: preparata.subject,
    html: preparata.html,
    attachments: preparata.attachments,
    scheduledAt: new Date(quando).toISOString()
  });

  if (resendError) {
    console.error('Resend Promemoria Error:', resendError);
    return { success: false, error: `Errore Resend Promemoria: ${resendError.message}` };
  }

  if (colonneNuove && inviata?.id) {
    const { error: erroreSalvataggio } = await supabase
      .from('appuntamenti')
      .update({
        promemoria_email_id: inviata.id,
        promemoria_email_per: new Date(quando).toISOString()
      })
      .eq('id', appointmentId);

    if (erroreSalvataggio) {
      console.error('Promemoria programmato ma non salvato in tabella:', erroreSalvataggio.message);
    }
  }

  console.log('Promemoria programmato per', new Date(quando).toISOString(), '→', preparata.email);
  return { success: true, programmatoPer: new Date(quando).toISOString() };
}

/**
 * Annulla il promemoria programmato (guida spostata o cancellata) e libera i campi,
 * così chi sposta l'appuntamento può riprogrammarlo subito dopo.
 */
export async function annullaPromemoriaProgrammato(appointmentId: string) {
  const supabase = createAdminClient();

  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select('id, promemoria_email_id')
    .eq('id', appointmentId)
    .maybeSingle();

  if (error) {
    if (/promemoria_email_id/.test(error.message)) return { success: true, saltato: true };
    console.error('Errore lettura promemoria programmato:', error.message);
    return { success: false, error: error.message };
  }

  const idResend = (apt as { promemoria_email_id?: string | null } | null)?.promemoria_email_id || null;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (idResend && resendApiKey) {
    try {
      await new Resend(resendApiKey).emails.cancel(idResend);
      console.log('Promemoria programmato annullato su Resend:', idResend);
    } catch (errore) {
      // Se era già partito non si può annullare: non è un errore bloccante.
      console.warn(
        'Impossibile annullare il promemoria programmato:',
        errore instanceof Error ? errore.message : errore
      );
    }
  }

  const { error: erroreReset } = await supabase
    .from('appuntamenti')
    .update({ promemoria_email_id: null, promemoria_email_per: null })
    .eq('id', appointmentId);

  if (erroreReset && !/promemoria_email_(id|per)/.test(erroreReset.message)) {
    console.error('Impossibile azzerare il promemoria programmato:', erroreReset.message);
  }

  return { success: true };
}

/**
 * Promemoria al PROPRIETARIO DEL CALENDARIO per un "altro impegno"
 * (es. Manuele Garzella sabato ha "R.C. ACI Collesalvetti").
 *
 * Il preavviso è scelto alla creazione dell'impegno (`promemoria_minuti`:
 * 120 = 2 ore prima, 240 = 4 ore, 720 = 12 ore, 1440 = 1 giorno, NULL = mai).
 * Va all'EMAIL dell'istruttore collegato (`istruttori.email`); la notifica push
 * viene inviata dallo stesso cron con `notificaCambioCalendario`.
 * Anche qui l'invio è marcato (`promemoria_inviato_il`) per non duplicarlo.
 */
export async function sendReminderImpegnoEmailAction(appointmentId: string) {
  const supabase = createAdminClient();

  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, data, inizio, durata, note,
      clienti ( nome, cognome ),
      istruttori ( nome, cognome, email )
    `)
    .eq('id', appointmentId)
    .maybeSingle();

  if (error || !apt) return { success: false, error: 'Impegno non trovato' };

  const istruttore = Array.isArray(apt.istruttori) ? apt.istruttori[0] : apt.istruttori;
  const cliente = Array.isArray(apt.clienti) ? apt.clienti[0] : apt.clienti;

  if (!istruttore?.email) return { success: false, error: 'Email istruttore mancante' };

  const nomeImpegno = cliente?.cognome || 'Impegno';
  // Ora ITALIANA: il server gira in UTC (altrimenti 21:15 diventava 20:15)
  const giorno = dataOraLungaItalia(apt.inizio || apt.data);

  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) return { success: false, error: 'Configurazione email mancante (API Key)' };

    const resend = new Resend(resendApiKey);
    const { error: resendError } = await resend.emails.send({
      from: SENDER,
      to: istruttore.email,
      subject: `Promemoria impegno: ${nomeImpegno} — ${dataLungaItalia(apt.inizio || apt.data)}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: #ffffff; border-radius: 24px; padding: 40px; border: 1px solid #f3f4f6; text-align: center;">
            <div style="color: #f59e0b; font-size: 18px; font-weight: 700; margin-bottom: 24px;">Promemoria impegno</div>
            <div style="color: #111827; font-size: 20px; font-weight: 600; line-height: 1.6;">
              ${nomeImpegno}<br>
              ${giorno}
              ${apt.durata ? `<br>Durata: ${apt.durata} min` : ''}
            </div>
            ${apt.note ? `<div style="margin-top: 24px; color: #6b7280; font-size: 14px; font-style: italic;">${apt.note}</div>` : ''}
            <div style="margin-top: 32px; color: #6b7280; font-size: 14px;">
              ${istruttore.nome} ${istruttore.cognome} — ${SEDE.nome}
            </div>
          </div>
        </div>
      `,
    });

    if (resendError) {
      console.error('Resend Impegno Reminder Error:', resendError);
      return { success: false, error: resendError.message };
    }

    return { success: true };
  } catch (errore) {
    console.error('Errore invio promemoria impegno:', errore);
    return { success: false, error: 'Errore imprevisto' };
  }
}

/** Riga impegno usata per costruire la mail di promemoria. */
type RigaImpegnoEmail = {
  id: string;
  data: string;
  inizio: string | null;
  durata: number | null;
  note: string | null;
  clienti?:
    | { nome?: string | null; cognome?: string | null }
    | { nome?: string | null; cognome?: string | null }[]
    | null;
  istruttori?:
    | { nome?: string | null; cognome?: string | null; email?: string | null }
    | { nome?: string | null; cognome?: string | null; email?: string | null }[]
    | null;
};

/**
 * Costruisce la mail di promemoria di un impegno: identica per l'invio immediato
 * (cron) e per quello programmato su Resend, così il testo non può divergere.
 */
function costruisciPromemoriaImpegno(riga: RigaImpegnoEmail):
  | { ok: false; error: string }
  | { ok: true; email: string; subject: string; html: string } {
  const istruttore = Array.isArray(riga.istruttori) ? riga.istruttori[0] : riga.istruttori;
  const cliente = Array.isArray(riga.clienti) ? riga.clienti[0] : riga.clienti;

  if (!istruttore?.email) return { ok: false, error: 'Email istruttore mancante' };

  const nomeImpegno = cliente?.cognome || 'Impegno';
  const quando = new Date(riga.inizio || riga.data);
  // Ora ITALIANA (server in UTC)
  const giorno = dataOraLungaItalia(quando);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="background: #ffffff; border-radius: 24px; padding: 40px; border: 1px solid #f3f4f6; text-align: center;">
        <div style="color: #f59e0b; font-size: 18px; font-weight: 700; margin-bottom: 24px;">Promemoria impegno</div>
        <div style="color: #111827; font-size: 20px; font-weight: 600; line-height: 1.6;">
          ${nomeImpegno}<br>
          ${giorno}
          ${riga.durata ? `<br>Durata: ${riga.durata} min` : ''}
        </div>
        ${riga.note ? `<div style="margin-top: 24px; color: #6b7280; font-size: 14px; font-style: italic;">${riga.note}</div>` : ''}
        <div style="margin-top: 32px; color: #6b7280; font-size: 14px;">
          ${istruttore.nome} ${istruttore.cognome} — ${SEDE.nome}
        </div>
      </div>
    </div>
  `;

  return {
    ok: true,
    email: istruttore.email,
    subject: `Promemoria impegno: ${nomeImpegno} — ${dataLungaItalia(quando)}`,
    html
  };
}

/**
 * Programma la mail di promemoria di un IMPEGNO all'istante esatto scelto
 * (`promemoria_minuti`: 120/240/720/1440 minuti prima dell'inizio).
 *
 * Perché serve: con il solo cron giornaliero i preavvisi brevi non arrivavano mai
 * (es. impegno alle 09:15 con "2 ore prima" → avviso alle 07:15, il cron gira alle
 * 06:30: troppo presto; il giorno dopo è troppo tardi). Così invece parte al minuto.
 *
 * Se il preavviso è già scattato non fa nulla: ci pensa il cron (push + email
 * insieme), così non si rischia di spedire due volte.
 */
export async function programmaPromemoriaImpegno(appointmentId: string) {
  const supabase = createAdminClient();

  const colonneBase = `
      id, data, inizio, durata, note, promemoria_minuti,
      clienti ( nome, cognome ),
      istruttori ( nome, cognome, email )
    `;

  let { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`${colonneBase}, promemoria_email_id`)
    .eq('id', appointmentId)
    .maybeSingle();

  let colonneNuove = true;
  if (error && /promemoria_email_id/.test(error.message)) {
    colonneNuove = false;
    console.warn('Colonna promemoria_email_id assente: esegui la migrazione 20261113180000_promemoria_programmato.sql');
    ({ data: apt, error } = await supabase
      .from('appuntamenti')
      .select(colonneBase)
      .eq('id', appointmentId)
      .maybeSingle());
  }

  if (error || !apt) return { success: false, error: 'Impegno non trovato' };

  const riga = apt as unknown as RigaImpegnoEmail & {
    promemoria_minuti?: number | null;
    promemoria_email_id?: string | null;
  };

  const preavviso = Number(riga.promemoria_minuti);
  if (!preavviso || Number.isNaN(preavviso)) {
    return { success: true, saltato: true, motivo: 'nessun promemoria impostato' };
  }
  if (riga.promemoria_email_id) {
    return { success: true, saltato: true, motivo: 'già programmato' };
  }

  const preparata = costruisciPromemoriaImpegno(riga);
  if (!preparata.ok) {
    // Istruttore senza email: come per il cliente, non c'è nulla da inviare e non
    // deve diventare un errore ripetuto.
    return { success: true, saltato: true, motivo: 'istruttore senza email' };
  }

  const inizio = new Date(riga.inizio || riga.data).getTime();
  if (Number.isNaN(inizio)) return { success: false, error: 'Orario non valido' };
  if (inizio <= Date.now()) return { success: true, saltato: true, motivo: 'impegno già iniziato' };

  const quando = inizio - preavviso * 60 * 1000;
  if (quando <= Date.now() + 60 * 1000) {
    return { success: true, saltato: true, motivo: 'preavviso già scattato: lo gestisce il cron' };
  }
  if (quando - Date.now() > MASSIMO_PROGRAMMAZIONE_MS) {
    return { success: false, error: 'Impegno troppo lontano per programmare la mail (max 30 giorni)' };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { success: false, error: 'Configurazione email mancante (API Key)' };

  const resend = new Resend(resendApiKey);
  const { data: inviata, error: resendError } = await resend.emails.send({
    from: SENDER,
    to: preparata.email,
    subject: preparata.subject,
    html: preparata.html,
    scheduledAt: new Date(quando).toISOString()
  });

  if (resendError) {
    console.error('Resend Promemoria Impegno Error:', resendError);
    return { success: false, error: resendError.message };
  }

  if (colonneNuove && inviata?.id) {
    const { error: erroreSalvataggio } = await supabase
      .from('appuntamenti')
      .update({
        promemoria_email_id: inviata.id,
        promemoria_email_per: new Date(quando).toISOString()
      })
      .eq('id', appointmentId);

    if (erroreSalvataggio) {
      console.error('Promemoria impegno programmato ma non salvato:', erroreSalvataggio.message);
    }
  }

  console.log('Promemoria impegno programmato per', new Date(quando).toISOString(), '→', preparata.email);
  return { success: true, programmatoPer: new Date(quando).toISOString() };
}

/**
 * RIPROGRAMMAZIONE DEL PROMEMORIA DOPO UNO SPOSTAMENTO.
 *
 * Il trascinamento nel calendario (e lo spostamento di una seduta d'esame) aggiorna
 * gli appuntamenti con un update diretto sul database, senza passare da
 * `updateAppointmentAction`: senza questa funzione il promemoria restava programmato
 * per il VECCHIO orario e per quello nuovo non ne partiva nessuno.
 *
 * IDEMPOTENTE: se la mail in coda è già all'orario giusto non tocca niente (non
 * consuma quota). Altrimenti annulla quella vecchia, riarma i marcatori e ne
 * programma una nuova con le regole solite: 24 ore prima per le guide, preavviso
 * scelto (2/4/12 ore, 1 giorno) per gli impegni.
 */
export async function riprogrammaPromemoriaAppuntamento(appointmentId: string) {
  const supabase = createAdminClient();

  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, inizio, data, send_email, promemoria_minuti,
      promemoria_email_per, promemoria_email_id, promemoria_email_inviato_il,
      clienti ( nome )
    `)
    .eq('id', appointmentId)
    .maybeSingle();

  if (error) {
    // Colonne della programmazione non presenti: non c'è nulla da riprogrammare
    if (/promemoria_/.test(error.message)) return { success: true, saltato: true };
    return { success: false, error: error.message };
  }
  if (!apt) return { success: false, error: 'appuntamento non trovato' };

  const inizio = new Date(apt.inizio || apt.data).getTime();
  if (Number.isNaN(inizio)) return { success: false, error: 'orario non valido' };
  if (inizio <= Date.now()) return { success: true, saltato: true, motivo: 'già iniziato' };

  const cliente = Array.isArray(apt.clienti) ? apt.clienti[0] : apt.clienti;
  const eImpegno = cliente?.nome === 'UFFICIO';

  const atteso = eImpegno
    ? (apt.promemoria_minuti ? inizio - Number(apt.promemoria_minuti) * 60 * 1000 : null)
    : inizio - ANTICIPO_PROMEMORIA_MS;

  const inCoda = apt.promemoria_email_per ? new Date(apt.promemoria_email_per).getTime() : null;

  // Già in coda all'orario giusto: niente da fare
  if (atteso !== null && inCoda !== null && Math.abs(inCoda - atteso) < 60 * 1000) {
    return { success: true, saltato: true, motivo: 'già programmato per il nuovo orario' };
  }

  // Spostata: il promemoria vecchio non vale più
  await annullaPromemoriaProgrammato(appointmentId);

  await supabase
    .from('appuntamenti')
    .update({
      promemoria_email_inviato_il: null,
      ...(eImpegno ? { promemoria_inviato_il: null } : {})
    })
    .eq('id', appointmentId);

  return eImpegno
    ? programmaPromemoriaImpegno(appointmentId)
    : programmaPromemoriaEmail(appointmentId);
}

/**
 * RIALLINEAMENTO DI UN PROMEMORIA IN CODA (riparazione).
 *
 * Serve per i promemoria rimasti programmati su un orario sbagliato (guide spostate
 * prima che lo spostamento riprogrammasse la mail). NON invia niente adesso:
 * programma la mail nuova all'orario corretto e SOLO DOPO annulla quella vecchia,
 * così se qualcosa va storto la vecchia resta valida.
 *
 * Se il momento giusto è già passato non fa nulla: nessuna raffica di mail, ci pensa
 * il flusso normale.
 */
export async function riallineaPromemoriaInCoda(appointmentId: string) {
  const supabase = createAdminClient();

  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, data, inizio, durata, note, send_email, promemoria_minuti,
      promemoria_email_per, promemoria_email_id,
      clienti ( nome, cognome, email ),
      istruttori ( nome, cognome, email ),
      veicoli ( nome, targa )
    `)
    .eq('id', appointmentId)
    .maybeSingle();

  if (error || !apt) return { success: false, error: 'appuntamento non trovato' };

  const inizio = new Date(apt.inizio || apt.data).getTime();
  if (Number.isNaN(inizio)) return { success: false, error: 'orario non valido' };

  const cliente = Array.isArray(apt.clienti) ? apt.clienti[0] : apt.clienti;
  const eImpegno = cliente?.nome === 'UFFICIO';

  // Guida con "invia email" disattivato: non va programmato niente
  if (!eImpegno && !apt.send_email) {
    return { success: true, saltato: true, motivo: 'email disattivata per questa guida' };
  }

  const atteso = eImpegno
    ? (apt.promemoria_minuti ? inizio - Number(apt.promemoria_minuti) * 60 * 1000 : null)
    : inizio - ANTICIPO_PROMEMORIA_MS;

  if (atteso === null) return { success: true, saltato: true, motivo: 'nessun promemoria previsto' };

  const adesso = Date.now();
  if (atteso <= adesso + 60 * 1000) {
    return { success: true, saltato: true, motivo: 'momento già passato: non si invia ora' };
  }
  if (atteso - adesso > MASSIMO_PROGRAMMAZIONE_MS) {
    // Oltre i 30 giorni Resend non accetta la programmazione: la aggancerà il cron
    // giornaliero quando la guida rientra nel limite.
    return { success: true, saltato: true, motivo: 'oltre i 30 giorni: la prende il cron più avanti' };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { success: false, error: 'Configurazione email mancante (API Key)' };

  const resend = new Resend(resendApiKey);
  const quandoISO = new Date(atteso).toISOString();

  // 1) prima la nuova: se fallisce, la vecchia resta dov'è
  let nuovaId: string | undefined;
  let erroreNuova: { message: string } | null = null;

  if (eImpegno) {
    // Promemoria di un impegno: nessun allegato .ics
    const preparata = costruisciPromemoriaImpegno(apt as unknown as RigaImpegnoEmail);
    if (!preparata.ok) return { success: true, saltato: true, motivo: 'destinatario senza email' };

    const esito = await resend.emails.send({
      from: SENDER,
      to: preparata.email,
      subject: preparata.subject,
      html: preparata.html,
      scheduledAt: quandoISO
    });
    nuovaId = esito.data?.id;
    erroreNuova = esito.error;
  } else {
    // Promemoria di una guida: con l'allegato .ics
    const preparata = costruisciPromemoriaCliente(apt as unknown as AppuntamentoEmail);
    if (!preparata.ok) return { success: true, saltato: true, motivo: 'cliente senza email' };

    const esito = await resend.emails.send({
      from: SENDER,
      to: preparata.email,
      subject: preparata.subject,
      html: preparata.html,
      attachments: preparata.attachments,
      scheduledAt: quandoISO
    });
    nuovaId = esito.data?.id;
    erroreNuova = esito.error;
  }

  if (erroreNuova) {
    console.error('Riallineamento promemoria: errore Resend', erroreNuova);
    return { success: false, error: erroreNuova.message };
  }

  // 2) poi si annulla la vecchia (se era già partita non si può: pazienza)
  const idVecchio = (apt as { promemoria_email_id?: string | null }).promemoria_email_id || null;
  if (idVecchio) {
    try {
      await resend.emails.cancel(idVecchio);
    } catch {
      /* già spedita */
    }
  }

  // 3) si salva la nuova
  const { error: erroreSalvataggio } = await supabase
    .from('appuntamenti')
    .update({
      promemoria_email_id: nuovaId || null,
      promemoria_email_per: new Date(atteso).toISOString()
    })
    .eq('id', appointmentId);

  if (erroreSalvataggio) {
    console.error('Riallineamento promemoria: non salvato in tabella', erroreSalvataggio.message);
  }

  return { success: true, programmatoPer: new Date(atteso).toISOString() };
}

/**
 * PROVA DELLA PUSH DI UN IMPEGNO (pulsante "Prova push" nel form, solo admin).
 *
 * Programma la mail dell'impegno fra N minuti (default 3). Quando Resend la spedisce
 * chiama il nostro webhook, che manda la push: così si verifica TUTTA la catena in
 * pochi minuti, senza aspettare un preavviso vero.
 *
 * Sostituisce l'eventuale promemoria già programmato per quell'impegno.
 * Consuma una mail: va usata solo per le prove.
 */
export async function provaPromemoriaImpegno(appointmentId: string, fraMinuti = 3) {
  const supabase = createAdminClient();

  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, data, inizio, durata, note,
      clienti ( nome, cognome ),
      istruttori ( nome, cognome, email )
    `)
    .eq('id', appointmentId)
    .maybeSingle();

  if (error || !apt) return { success: false, error: 'Impegno non trovato' };

  const preparata = costruisciPromemoriaImpegno(apt as unknown as RigaImpegnoEmail);
  if (!preparata.ok) return { success: false, error: preparata.error };

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { success: false, error: 'Configurazione email mancante (API Key)' };

  const minuti = Math.max(1, fraMinuti);
  const quando = new Date(Date.now() + minuti * 60 * 1000);

  const resend = new Resend(resendApiKey);
  const { data: inviata, error: resendError } = await resend.emails.send({
    from: SENDER,
    to: preparata.email,
    subject: `PROVA promemoria (fra ${minuti} min) — ${preparata.subject}`,
    html: preparata.html,
    scheduledAt: quando.toISOString()
  });

  if (resendError) {
    console.error('Prova promemoria impegno: errore Resend', resendError);
    return { success: false, error: resendError.message };
  }

  // La mail è in coda: quando parte, il webhook manderà la push. Il marcatore
  // dell'avviso va azzerato, altrimenti la push verrebbe saltata come "già inviata".
  await supabase
    .from('appuntamenti')
    .update({
      promemoria_email_id: inviata?.id || null,
      promemoria_email_per: quando.toISOString(),
      promemoria_inviato_il: null
    })
    .eq('id', appointmentId);

  console.log(`Prova push programmata per ${quando.toISOString()} → ${preparata.email}`);
  return { success: true, quando: quando.toISOString(), a: preparata.email };
}

/**
 * AVVISO DI GUIDA ANNULLATA al cliente.
 *
 * Stesso formato delle altre email (template grafico solito), con una sola frase:
 *   "La guida del giorno 13/11/2026 alle ore 15:00 è stata annullata"
 * Nessun importo della penale e nessuna nota sulle 24 ore: il cliente deve solo
 * sapere che la guida non c'è più.
 *
 * Usata sia dall'annullamento (✕ con penale) sia dall'eliminazione definitiva:
 * per il cliente l'evento è lo stesso.
 */
export async function sendCancellationEmailAction(appointmentData: {
  data: string;
  durata?: number | null;
  clienti?:
    | { nome?: string | null; cognome?: string | null; email?: string | null }
    | { nome?: string | null; cognome?: string | null; email?: string | null }[]
    | null;
}) {
  const cliente = Array.isArray(appointmentData?.clienti)
    ? appointmentData.clienti[0]
    : appointmentData?.clienti;
  const emailCliente = cliente?.email;
  if (!emailCliente) return { success: false, error: 'Email cliente mancante' };

  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) return { success: false, error: 'Configurazione email mancante (API Key)' };

    const dateStr = dataItaliaISO(appointmentData.data);
    const timeStr = getItalyTimeStr(appointmentData.data);
    const giorno = format(parseISO(dateStr), 'd MMMM', { locale: it });

    const html = getEmailTemplate({
      title: 'Guida annullata',
      name: cliente.nome || '',
      date: dateStr,
      time: timeStr,
      duration: appointmentData.durata || 0,
      instructor: '',
      vehicle: '',
      isCancellation: true,
      // La frase richiesta, identica allo stile delle altre email
      testo: `La guida del giorno ${format(parseISO(dateStr), 'dd/MM/yyyy')} alle ore ${timeStr} è stata annullata`,
      // Niente nota sulle 24 ore né "per disdire chiama...": la guida è già annullata
      nascondiNota: true
    });

    const resend = new Resend(resendApiKey);
    const { error: resendError } = await resend.emails.send({
      from: SENDER,
      to: emailCliente,
      subject: `Guida annullata - ${giorno} alle ${timeStr}`,
      html
    });

    if (resendError) {
      console.error('Cancellation Email Error:', resendError);
      return { success: false, error: resendError.message };
    }

    console.log('Avviso di annullamento inviato a:', emailCliente);
    return { success: true };
  } catch (e) {
    console.error('Cancellation Email Error:', e);
    return { success: false, error: 'Errore imprevisto durante l\'invio' };
  }
}
