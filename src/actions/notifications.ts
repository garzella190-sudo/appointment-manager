'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { Resend } from 'resend';
import { format, parseISO, addMinutes } from 'date-fns';
import { it } from 'date-fns/locale';

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
  isModification = false
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
                : `Ricorda la guida programmata per ${format(parseISO(`${date}T${time}`), "EEEE d MMMM 'alle' HH:mm", { locale: it })}\nDurata: ${duration} min`
            }
          </div>

          <div class="disclaimer">
            NB: le guide vanno disdette 24h prima, pena addebito dell'importo
          </div>
          <div class="contact-info">
            Per disdire le guide chiama in autoscuola oppure contatta il tuo istruttore
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

/**
 * Generates ICS string content
 */
function generateICS(apt: any) {
  const startDate = new Date(apt.inizio);
  const endDate = new Date(startDate.getTime() + (apt.durata || 60) * 60000);
  const formatICS = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const address = "Via Le Vallicelle, 4, 56043 Fauglia (PI)";

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Autoscuola Toscana Fauglia//IT',
    'BEGIN:VEVENT',
    `DTSTART:${formatICS(startDate)}`,
    `DTEND:${formatICS(endDate)}`,
    `SUMMARY:Lezione di Guida`,
    `DESCRIPTION:Sede: Autoscuola Toscana Fauglia\\nIndirizzo: ${address}`,
    'LOCATION:Autoscuola Toscana Fauglia',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

export async function sendConfirmationEmailAction(appointmentId: string, isModification = false) {
  const supabase = createAdminClient();

  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, data, durata, inizio, 
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

  const icsStr = generateICS(apt);

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
      isModification: isModification
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
          content: Buffer.from(icsStr).toString('base64'),
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

export async function sendReminderEmailAction(appointmentId: string) {
  const supabase = createAdminClient();

  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, data, durata, inizio, 
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

  const icsStr = generateICS(apt);

  try {
    const html = getEmailTemplate({
      title: 'Promemoria',
      name: clientName,
      date: dateStr,
      time: timeStr,
      duration: apt.durata,
      instructor: instructorName,
      vehicle: vehicleName,
      isReminder: true
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
      subject: `Promemoria: Lezione di Guida - ${format(parseISO(dateStr), 'd MMMM', { locale: it })} alle ${timeStr} (${apt.durata} min)`,
      html,
      attachments: [
        {
          filename: 'guida.ics',
          content: Buffer.from(icsStr).toString('base64'),
        }
      ]
    });

    if (resendError) {
      console.error('Resend Reminder Error:', resendError);
      return { success: false, error: `Errore Resend Promemoria: ${resendError.message}` };
    }

    console.log('Reminder email sent successfully to:', cliente.email, 'Data:', data);
    return { success: true };
  } catch (error) {
    console.error('Errore imprevisto invio promemoria:', error);
    return { success: false, error: 'Errore imprevisto durante l\'invio del promemoria' };
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
