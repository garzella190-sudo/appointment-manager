'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';
import { format, parseISO, addMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import { sendConfirmationEmailAction } from './notifications';
import { sendNotificationToInstructor } from '@/lib/pushHelper';

// Initialized lazily inside the action

export async function createAppointmentAction(payload: {
  cliente_id?: string;
  is_impegno?: boolean;
  nome_impegno?: string;
  istruttore_id: string;
  veicolo_id: string | null;
  data: string; // "YYYY-MM-DDTHH:mm" locally or ISO
  data_solo?: string; // "YYYY-MM-DD"
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
  
  // Use explicit data_solo if provided, otherwise extract from input string
  const dateOnly = payload.data_solo || payload.data.split('T')[0];

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
  const { email_fallback, preferenza_cambio, is_impegno, nome_impegno, importo: payloadImporto, ...dbPayload } = payload;
  
  let finalImporto = payloadImporto;
  if (!is_impegno && finalImporto === null) {
    if (payload.durata === 30) finalImporto = 25;
    else if (payload.durata === 60) finalImporto = 50;
  }
  
  const { data: appointment, error: appointmentError } = await supabase
    .from('appuntamenti')
    .insert({
      ...dbPayload,
      importo: finalImporto,
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


  // 3. Email notification (Centralized logic)
  let notificationSent = false;
  let emailError = null;
  if (finalEmail && (payload.send_email ?? clientData.riceve_email)) {
    try {
      const emailRes = await sendConfirmationEmailAction(appointment.id);
      if (emailRes.success) {
        notificationSent = true;
      } else {
        emailError = emailRes.error;
      }
    } catch (e: any) {
      console.error('Notification Error:', e);
      emailError = e.message;
    }
  }

  // 4. Web Push Notification to Instructor
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserIstruttoreId = session?.user?.user_metadata?.istruttore_id;
    
    // Send if the person creating the appointment is NOT the assigned instructor
    if (currentUserIstruttoreId !== payload.istruttore_id) {
      const clientName = clientData.nome && clientData.nome !== 'UFFICIO' 
        ? `${clientData.nome} ${clientData.cognome}` 
        : (payload.nome_impegno || 'Impegno');
        
      const timeStr = format(new Date(payload.data), 'dd/MM HH:mm', { locale: it });
      
      await sendNotificationToInstructor(payload.istruttore_id, {
        title: 'Nuova Guida Inserita',
        body: `È stata inserita una guida per ${clientName} il ${timeStr}`,
        url: '/'
      });
    }
  } catch (err) {
    console.error('Web Push Error:', err);
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');
  revalidatePath('/');

  return { success: true, appointment, notificationSent, emailError };
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
  
  // Use explicit data_solo if provided, otherwise extract from input string
  const dateOnly = payload.data_solo || payload.data.split('T')[0];

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

  // 3. Email notification (Centralized logic)
  let notificationSent = false;
  let emailError = null;
  if (data && payload.send_email) {
    try {
      const emailRes = await sendConfirmationEmailAction(data.id);
      if (emailRes.success) {
        notificationSent = true;
      } else {
        emailError = emailRes.error;
      }
    } catch (e: any) {
      console.error('Notification Error:', e);
      emailError = e.message;
    }
  }

  // 4. Web Push Notification to Instructor
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserIstruttoreId = session?.user?.user_metadata?.istruttore_id;
    
    // Send if the person modifying the appointment is NOT the assigned instructor
    if (currentUserIstruttoreId !== payload.istruttore_id) {
      const timeStr = format(new Date(payload.data), 'dd/MM HH:mm', { locale: it });
      
      await sendNotificationToInstructor(payload.istruttore_id, {
        title: 'Guida Modificata',
        body: `Una guida è stata modificata: ora è prevista il ${timeStr}`,
        url: '/'
      });
    }
  } catch (err) {
    console.error('Web Push Error:', err);
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');
  revalidatePath('/');

  return { success: true, appointment: data, notificationSent, emailError };
}
