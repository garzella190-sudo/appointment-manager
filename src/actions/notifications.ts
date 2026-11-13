'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { Resend } from 'resend';
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
  aggiungiAlCalendario
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
            ${isCancellation 
              ? `La tua guida del ${format(parseISO(`${date}T${time}`), "EEEE d MMMM 'alle' HH:mm", { locale: it })} è stata ELIMINATA`
              : isModification
                ? `La tua guida è stata MODIFICATA per il ${format(parseISO(`${date}T${time}`), "EEEE d MMMM 'alle' HH:mm", { locale: it })}\nDurata: ${duration} min`
                : isReminder
                  ? `Ricordati la guida per il giorno ${format(parseISO(date), 'dd/MM/yyyy')} alle ore ${time}\nDurata: ${duration} min`
                  : `La guida per il giorno ${format(parseISO(date), 'dd/MM/yyyy')} alle ore ${time} è stata prenotata correttamente\nDurata: ${duration} min`
            }
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

          <div class="disclaimer">
            NB: le guide vanno disdette 24h prima, pena addebito dell'importo
          </div>
          <div class="contact-info">
            Per disdire le guide chiama in autoscuola oppure contatta il tuo istruttore<br>
            ${SEDE.nome} — ${SEDE.indirizzo}
          </div>
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
  const dateStr = apt.data.split('T')[0];
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
 * IDEMPOTENTE: prima di spedire controlla `promemoria_email_inviato_il`. Se è già
 * valorizzato il promemoria è stato mandato e la funzione esce senza inviare nulla.
 * Dopo l'invio scrive il timestamp, così nessun altro giro (cron, riprova, chiamata
 * manuale) può rispedirlo: il cliente riceve UNA sola mail per appuntamento.
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

  const colonnaMancante = Boolean(error && /promemoria_email_inviato_il/.test(error.message));
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

  const cliente = Array.isArray(apt.clienti) ? apt.clienti[0] : apt.clienti;
  const istruttore = Array.isArray(apt.istruttori) ? apt.istruttori[0] : apt.istruttori;
  const veicolo = Array.isArray(apt.veicoli) ? apt.veicoli[0] : apt.veicoli;

  if (!cliente?.email) return { success: false, error: 'Email cliente mancante' };

  const clientName = `${cliente.nome}`;
  const instructorName = istruttore ? `${istruttore.nome} ${istruttore.cognome}` : 'Non assegnato';
  const vehicleName = veicolo ? `${veicolo.nome} (${veicolo.targa})` : 'Non assegnato';
  const dateStr = apt.data.split('T')[0];
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
      return { success: false, error: `Errore Resend Promemoria: ${resendError.message}` };
    }

    // Marca l'invio: da qui in poi questo appuntamento non riceverà altri promemoria
    if (!colonnaMancante) {
      const { error: erroreMarchio } = await supabase
        .from('appuntamenti')
        .update({ promemoria_email_inviato_il: new Date().toISOString() })
        .eq('id', appointmentId);

      if (erroreMarchio) {
        console.error('Promemoria inviato ma non marcato (rischio doppio invio):', erroreMarchio.message);
      }
    }

    console.log('Reminder email sent successfully to:', cliente.email, 'Data:', data);
    return { success: true };
  } catch (error) {
    console.error('Errore imprevisto invio promemoria:', error);
    return { success: false, error: 'Errore imprevisto durante l\'invio del promemoria' };
  }
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
  const giorno = format(new Date(apt.inizio || apt.data), "EEEE d MMMM 'alle' HH:mm", { locale: it });

  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) return { success: false, error: 'Configurazione email mancante (API Key)' };

    const resend = new Resend(resendApiKey);
    const { error: resendError } = await resend.emails.send({
      from: SENDER,
      to: istruttore.email,
      subject: `Promemoria impegno: ${nomeImpegno} — ${format(new Date(apt.inizio || apt.data), 'd MMMM', { locale: it })}`,
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

export async function sendCancellationEmailAction(appointmentData: any) {
  // appointmentData is the object before deletion
  if (!appointmentData?.clienti?.email) return { success: false };

  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) return { success: false };

    const dateStr = appointmentData.data.split('T')[0];
    const timeStr = getItalyTimeStr(appointmentData.data);

    const html = getEmailTemplate({
      title: 'Guida Eliminata',
      name: appointmentData.clienti.nome,
      date: dateStr,
      time: timeStr,
      duration: appointmentData.durata,
      instructor: '',
      vehicle: '',
      isCancellation: true
    });

    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: SENDER,
      to: appointmentData.clienti.email,
      subject: `ELIMINATA: Guida del ${format(parseISO(dateStr), 'd MMMM', { locale: it })} alle ${timeStr}`,
      html
    });

    return { success: true };
  } catch (e) {
    console.error('Cancellation Email Error:', e);
    return { success: false };
  }
}
