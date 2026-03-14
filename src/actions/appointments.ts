'use server';

import { createClient } from '@/utils/supabase/server';
import { Resend } from 'resend';
import { format, parseISO, addMinutes } from 'date-fns';
import { it } from 'date-fns/locale';

// Initialized lazily inside the action

export async function createAppointmentAction(payload: {
  cliente_id: string;
  istruttore_id: string;
  veicolo_id: string | null;
  data: string; // ISO string
  durata: number;
  stato: string;
  note: string | null;
  importo: number | null;
  send_email?: boolean;
  send_whatsapp?: boolean;
}) {
  const supabase = createClient();
  const resendApiKey = process.env.RESEND_API_KEY;

  // 1. Fetch customer details
  const { data: cliente, error: clienteError } = await (await supabase)
    .from('clienti')
    .select('email, nome, cognome, riceve_email, riceve_whatsapp')
    .eq('id', payload.cliente_id)
    .single();

  // If columns are missing or client not found, we still want to try creating the appointment
  // but we might skip notifications or use defaults.
  const clientData = cliente || { 
    email: null, 
    nome: '', 
    cognome: '', 
    riceve_email: true, 
    riceve_whatsapp: true 
  };

  // 2. Insert appointment (exclude notification flags from DB payload)
  const { send_email, send_whatsapp, ...dbPayload } = payload;
  
  const { data: appointment, error: appointmentError } = await (await supabase)
    .from('appuntamenti')
    .insert(dbPayload)
    .select()
    .single();

  if (appointmentError) {
    console.error('Error creating appointment:', appointmentError);
    return { error: appointmentError.message };
  }

  // 3. Send confirmation email if client has email AND preference is enabled
  // prioritize form override, fallback to client preference
  const shouldSendEmail = send_email !== undefined ? send_email : clientData.riceve_email;

  if (clientData.email && shouldSendEmail && resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const startDate = parseISO(payload.data);
      const endDate = addMinutes(startDate, payload.durata);

      // Format for email body
      const dateStr = format(startDate, 'dd/MM/yyyy', { locale: it });
      const timeStr = format(startDate, 'HH:mm', { locale: it });

      // Format for Google Calendar (YYYYMMDDTHHMMSSZ)
      // Using toISOString and then stripping non-numeric characters for the 'dates' parameter.
      // This ensures the time is in UTC and correctly formatted for Google Calendar.
      const formatGCal = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
      const gcalStart = formatGCal(startDate);
      const gcalEnd = formatGCal(endDate);

      const calendarUrl = new URL('https://www.google.com/calendar/render');
      calendarUrl.searchParams.append('action', 'TEMPLATE');
      calendarUrl.searchParams.append('text', 'Lezione di Guida - Autoscuola Toscana Fauglia');
      calendarUrl.searchParams.append('dates', `${gcalStart}/${gcalEnd}`);
      calendarUrl.searchParams.append('location', 'ci troviamo in autoscuola salvo diversi accordi');
      
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <h2 style="color: #10b981;">Prenotazione Confermata</h2>
          <p>Ciao <strong>${clientData.nome}</strong>,</p>
          <p>Ti confermo la prenotazione per il giorno <strong>${dateStr}</strong> alle ore <strong>${timeStr}</strong>.</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${calendarUrl.toString()}" 
               style="background-color: #3b82f6; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.5);">
              Aggiungi al Calendario
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; pt: 20px; margin-top: 30px;">
            Ci troviamo in autoscuola salvo diversi accordi.<br>
            <em>A presto!</em>
          </p>
        </div>
      `;

      await resend.emails.send({
        from: 'Autoscuola <onboarding@resend.dev>', // Should use verified domain in production
        to: clientData.email,
        subject: 'Conferma Prenotazione Guida',
        html: emailHtml,
      });

    } catch (emailErr) {
      console.error('Error sending email:', emailErr);
      // We don't fail the whole action if only the email fails
    }
  }

  return { success: true, appointment };
}
