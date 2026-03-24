'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';
import { format, parseISO, addMinutes } from 'date-fns';
import { it } from 'date-fns/locale';

// Initialized lazily inside the action

export async function createAppointmentAction(payload: {
  cliente_id?: string;
  is_impegno?: boolean;
  nome_impegno?: string;
  istruttore_id: string;
  veicolo_id: string | null;
  data: string; // ISO string
  durata: number;
  stato: string;
  note: string | null;
  importo: number | null;
  send_email?: boolean;
  send_whatsapp?: boolean;
  email_fallback?: string | null;
  preferenza_cambio?: string | null;
}) {
  const supabase = await createClient();
  const resendApiKey = process.env.RESEND_API_KEY;

  let finalClienteId = payload.cliente_id;

  // 1. Fictitious Client Logic for Impegni
  if (payload.is_impegno && payload.nome_impegno) {
    const { data: existing } = await supabase
      .from('clienti')
      .select('id')
      .eq('cognome', payload.nome_impegno)
      .eq('nome', 'UFFICIO')
      .single();
    
    if (existing) {
      finalClienteId = existing.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from('clienti')
        .insert({ 
          nome: 'UFFICIO', 
          cognome: payload.nome_impegno.toUpperCase() 
        })
        .select()
        .single();
      
      if (createError) {
        return { success: false, error: "Errore creazione slot impegno: " + createError.message };
      }
      finalClienteId = created.id;
    }
  }

  if (!finalClienteId) return { success: false, error: "Cliente non specificato." };

  // 0. Universal Overlap Check
  const startTime = new Date(payload.data);
  startTime.setSeconds(0, 0); // Zeroing for precision
  const endTime = new Date(startTime.getTime() + payload.durata * 60000);
  endTime.setSeconds(0, 0);
  
  const startISO = startTime.toISOString();
  const endISO = endTime.toISOString();
  
  // Robust date_solo: extract YYYY-MM-DD from the local date/time provided, or from the ISO
  // Since payload.data is expected to be "YYYY-MM-DDTHH:mm", we can split by T.
  const dateOnly = payload.data.includes('T') ? payload.data.split('T')[0] : payload.data;

  console.log('DEBUG: Creating appointment', {
    dateOnly,
    startISO,
    endISO
  });

  // Logic: An instructor, client, or vehicle cannot have two overlapping appointments.
  // We use strict inequality to allow back-to-back appointments (e.g., 16:00-17:00 and 17:00-18:00)
  // but block even 1 minute overlap.
  
  // 1. Instructor Check
  const { data: instructorBusy } = await supabase
    .from('appuntamenti')
    .select('id')
    .is('eliminato_il', null)
    .neq('stato', 'annullato')
    .eq('istruttore_id', payload.istruttore_id)
    .lt('inizio', endISO)
    .gt('fine', startISO);

  if (instructorBusy && instructorBusy.length > 0) {
    return { success: false, error: "Istruttore già impegnato in questa fascia oraria." };
  }

  // 2. Client Check (skip for Impegni: they share the UFFICIO client ID)
  if (!payload.is_impegno) {
    const { data: clientBusy } = await supabase
      .from('appuntamenti')
      .select('id')
      .is('eliminato_il', null)
      .neq('stato', 'annullato')
      .eq('cliente_id', finalClienteId)
      .lt('inizio', endISO)
      .gt('fine', startISO);

    if (clientBusy && clientBusy.length > 0) {
      return { success: false, error: "Il cliente ha già un'altra guida in questo orario." };
    }
  }

  // 3. Vehicle Check (if applicable)
  if (payload.veicolo_id) {
    const { data: vehicleBusy } = await supabase
      .from('appuntamenti')
      .select('id')
      .is('eliminato_il', null)
      .neq('stato', 'annullato')
      .eq('veicolo_id', payload.veicolo_id)
      .lt('inizio', endISO)
      .gt('fine', startISO);

    if (vehicleBusy && vehicleBusy.length > 0) {
      return { success: false, error: "Veicolo già in uso in questa fascia oraria." };
    }
  }

  // 1. Fetch customer details
  const { data: cliente, error: clienteError } = await supabase
    .from('clienti')
    .select('email, nome, cognome, riceve_email, riceve_whatsapp')
    .eq('id', finalClienteId)
    .single();

  const clientData = cliente || { 
    email: null, 
    nome: '', 
    cognome: '', 
    riceve_email: true, 
    riceve_whatsapp: true 
  };

  // 1.5 Update client email if fallback provided or transmission preference
  let finalEmail = clientData.email;
  
  const updates: any = {};
  if (payload.email_fallback && !clientData.email) updates.email = payload.email_fallback;
  if (payload.preferenza_cambio) updates.preferenza_cambio = payload.preferenza_cambio;

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from('clienti')
      .update(updates)
      .eq('id', finalClienteId);
    
    if (!updateError) {
      if (updates.email) finalEmail = payload.email_fallback;
    }
  }

  // 2. Insert appointment (with inizio and fine)
  const { email_fallback, preferenza_cambio, is_impegno, nome_impegno, ...dbPayload } = payload;
  
  const { data: appointment, error: appointmentError } = await supabase
    .from('appuntamenti')
    .insert({
      ...dbPayload,
      cliente_id: finalClienteId,
      inizio: startISO,
      fine: endISO,
      data_solo: dateOnly // Helper column for performance
    })
    .select()
    .single();

  if (appointmentError) {
    console.error('APPOINTMENT_CREATE_ERROR:', appointmentError);
    return { 
      success: false, 
      error: `Errore: ${appointmentError.message}` 
    };
  }


  // 3. Email notification (unchanged logic)
  if (finalEmail && (payload.send_email ?? clientData.riceve_email) && resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const startDate = parseISO(payload.data);
      const endDate = addMinutes(startDate, payload.durata);
      const dateStr = format(startDate, 'dd/MM/yyyy', { locale: it });
      const timeStr = format(startDate, 'HH:mm', { locale: it });

      const formatGCal = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
      const gcalStart = formatGCal(startDate);
      const gcalEnd = formatGCal(endDate);

      const calendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=Lezione+di+Guida+-+Autoscuola+Toscana+Fauglia&dates=${gcalStart}/${gcalEnd}&location=ci+troviamo+in+autoscuola+salvo+diversi+accordi`;
      
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333 text-align: left;">
          <h2 style="color: #10b981;">Prenotazione Confermata</h2>
          <p>Ciao <strong>${clientData.nome}</strong>,</p>
          <p>Ti confermo la prenotazione per il giorno <strong>${dateStr}</strong> alle ore <strong>${timeStr}</strong>.</p>
          <div style="margin: 30px 0;">
            <a href="${calendarUrl}" style="background-color: #3b82f6; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Aggiungi al Calendario</a>
          </div>
          <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px;">Ci troviamo in autoscuola salvo diversi accordi.</p>
        </div>
      `;

      await resend.emails.send({
        from: 'Autoscuola <onboarding@resend.dev>',
        to: finalEmail,
        subject: 'Conferma Prenotazione Guida',
        html: emailHtml,
      });
    } catch (e) {}
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true, appointment };
}

export async function updateAppointmentAction(id: string, payload: any) {
  const supabase = await createClient();
  
  let finalClienteId = payload.cliente_id;

  if (payload.is_impegno && payload.nome_impegno) {
    const { data: existing } = await supabase
      .from('clienti')
      .select('id')
      .eq('cognome', payload.nome_impegno)
      .eq('nome', 'UFFICIO')
      .single();
    
    if (existing) {
      finalClienteId = existing.id;
    } else {
      const { data: created } = await supabase
        .from('clienti')
        .insert({ 
          nome: 'UFFICIO', 
          cognome: payload.nome_impegno.toUpperCase() 
        })
        .select()
        .single();
      finalClienteId = created?.id;
    }
  }

  if (!finalClienteId) return { success: false, error: "Cliente non specificato." };

  // 0. Universal Overlap Check
  const startTime = new Date(payload.data);
  startTime.setSeconds(0, 0); // Zeroing for precision
  const endTime = new Date(startTime.getTime() + payload.durata * 60000);
  endTime.setSeconds(0, 0);
  
  const startISO = startTime.toISOString();
  const endISO = endTime.toISOString();
  const dateOnly = payload.data.split('T')[0];

  console.log('DEBUG: Creating appointment', {
    localData: payload.data,
    startISO,
    endISO,
    durata: payload.durata,
    istruttore: payload.istruttore_id,
    cliente: payload.cliente_id
  });

  // 1. Instructor Check
  const { data: instructorBusy } = await supabase
    .from('appuntamenti')
    .select('id')
    .is('eliminato_il', null)
    .neq('id', id)
    .neq('stato', 'annullato')
    .eq('istruttore_id', payload.istruttore_id)
    .lt('inizio', endISO)
    .gt('fine', startISO);

  if (instructorBusy && instructorBusy.length > 0) {
    return { success: false, error: "Istruttore già impegnato in questa fascia oraria." };
  }

  // 2. Client Check (skip for Impegni: they share the UFFICIO client ID)
  if (!payload.is_impegno) {
    const { data: clientBusy } = await supabase
      .from('appuntamenti')
      .select('id')
      .is('eliminato_il', null)
      .neq('id', id)
      .neq('stato', 'annullato')
      .eq('cliente_id', finalClienteId)
      .lt('inizio', endISO)
      .gt('fine', startISO);

    if (clientBusy && clientBusy.length > 0) {
      return { success: false, error: "Il cliente ha già un'altra guida in questo orario." };
    }
  }

  // 3. Vehicle Check
  if (payload.veicolo_id) {
    const { data: vehicleBusy } = await supabase
      .from('appuntamenti')
      .select('id')
      .is('eliminato_il', null)
      .neq('id', id)
      .neq('stato', 'annullato')
      .eq('veicolo_id', payload.veicolo_id)
      .lt('inizio', endISO)
      .gt('fine', startISO);

    if (vehicleBusy && vehicleBusy.length > 0) {
      return { success: false, error: "Veicolo già in uso in questa fascia oraria." };
    }
  }

  const { email_fallback, preferenza_cambio, is_impegno, nome_impegno, ...dbPayload } = payload;
  const { data, error } = await supabase
    .from('appuntamenti')
    .update({
      ...dbPayload,
      cliente_id: finalClienteId,
      inizio: startISO,
      fine: endISO,
      data_solo: dateOnly
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { 
      success: false, 
      error: 'Attenzione: Errore durante l\'aggiornamento dell\'appuntamento.' 
    };
  }


  // Update client preference if provided
  if (payload.preferenza_cambio) {
    await supabase
      .from('clienti')
      .update({ preferenza_cambio: payload.preferenza_cambio })
      .eq('id', payload.cliente_id || finalClienteId);
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true, appointment: data };
}
