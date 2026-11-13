'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';
import { format, parseISO, addMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import { sendConfirmationEmailAction } from './notifications';
import { notificaCambioCalendario } from '@/lib/pushHelper';

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
  sessione_esame_id?: string | null;
  /** Minuti di preavviso per il promemoria al proprietario (impegni). null = mai */
  promemoria_minuti?: number | null;
}) {
  const supabase = await createClient();
  const resendApiKey = process.env.RESEND_API_KEY;

  let finalClienteId = payload.cliente_id;

  // 1. Fictitious Client Logic for Impegni
  if (payload.is_impegno && payload.nome_impegno) {
    const { data: existing } = await supabase
      .from('clienti')
      .select('id')
      .eq('nome', 'UFFICIO')
      .eq('cognome', payload.nome_impegno.toUpperCase())
      .in('telefono', [
        'DEFAULT', '+39DEFAULT', 
        payload.istruttore_id.substring(0, 15), 
        '+39' + payload.istruttore_id.substring(0, 15)
      ])
      .limit(1)
      .maybeSingle();
    
    if (existing) {
      finalClienteId = existing.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from('clienti')
        .insert({ 
          nome: 'UFFICIO', 
          cognome: payload.nome_impegno.toUpperCase(),
          telefono: payload.istruttore_id.substring(0, 15)
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
  
  const rigaNuova: Record<string, unknown> = {
    ...dbPayload,
    importo: finalImporto,
    cliente_id: finalClienteId,
    inizio: startISO,
    fine: endISO,
    data_solo: dateOnly // Helper column for performance
  };

  let inserimento = await supabase.from('appuntamenti').insert(rigaNuova).select().single();
  let avviso: string | null = null;

  // Se la migrazione dei promemoria non è ancora stata applicata, la colonna
  // `promemoria_minuti` non esiste: si riprova senza, invece di bloccare il salvataggio.
  // Però il promemoria NON viene salvato: va detto all'utente, altrimenti imposta un
  // preavviso che non partirà mai.
  if (inserimento.error && /promemoria_minuti/.test(inserimento.error.message)) {
    console.warn('Colonna promemoria_minuti assente: esegui la migrazione 20261110140000_promemoria.sql');
    if (rigaNuova.promemoria_minuti) {
      avviso = 'Promemoria NON salvato: manca la colonna promemoria_minuti. Esegui la migrazione 20261110140000_promemoria.sql su Supabase.';
    }
    const { promemoria_minuti, ...senzaPromemoria } = rigaNuova;
    inserimento = await supabase.from('appuntamenti').insert(senzaPromemoria).select().single();
  }

  const { data: appointment, error: appointmentError } = inserimento;

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

  // 4. Web Push — la notifica va SOLO al proprietario del calendario toccato e mai
  // a chi ha inserito la guida: prenotando su se stessi non arriva niente a nessuno.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const clientName = clientData.nome && clientData.nome !== 'UFFICIO' 
      ? `${clientData.cognome} ${clientData.nome}` 
      : (payload.nome_impegno || 'Impegno');
      
    const giorno = format(startTime, 'EEE d MMM', { locale: it });
    const ora = format(startTime, 'HH:mm', { locale: it });
    
    await notificaCambioCalendario({
      istruttoriCoinvolti: [payload.istruttore_id],
      attoreUserId: user?.id,
      payload: {
        title: '📅 Nuova guida inserita',
        body: `${clientName} — ${giorno} alle ${ora}`,
        url: '/calendar'
      },
    });
  } catch (err) {
    console.error('Web Push Error:', err);
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');
  revalidatePath('/');

  return { success: true, appointment, notificationSent, emailError, avviso };
}

export async function updateAppointmentAction(id: string, payload: any) {
  const supabase = await createClient();

  // Istruttore attuale: serve per avvisare anche il "vecchio" calendario se la guida viene spostata
  const { data: primaDellaModifica } = await supabase
    .from('appuntamenti')
    .select('istruttore_id, veicolo_id, data, inizio, clienti ( nome, cognome )')
    .eq('id', id)
    .maybeSingle();
  const istruttorePrecedente: string | null = primaDellaModifica?.istruttore_id ?? null;
  const clientePrecedente = Array.isArray(primaDellaModifica?.clienti)
    ? primaDellaModifica?.clienti[0]
    : primaDellaModifica?.clienti;
  
  let finalClienteId = payload.cliente_id;

  if (payload.is_impegno && payload.nome_impegno) {
    const { data: existing } = await supabase
      .from('clienti')
      .select('id')
      .eq('nome', 'UFFICIO')
      .eq('cognome', payload.nome_impegno.toUpperCase())
      .in('telefono', [
        'DEFAULT', '+39DEFAULT', 
        payload.istruttore_id.substring(0, 15), 
        '+39' + payload.istruttore_id.substring(0, 15)
      ])
      .limit(1)
      .maybeSingle();
    
    if (existing) {
      finalClienteId = existing.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from('clienti')
        .insert({ 
          nome: 'UFFICIO', 
          cognome: payload.nome_impegno.toUpperCase(),
          telefono: payload.istruttore_id.substring(0, 15)
        })
        .select()
        .single();
      
      if (createError) {
        return { success: false, error: "Errore creazione slot impegno: " + createError.message };
      }
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
  const rigaAggiornata: Record<string, unknown> = {
    ...dbPayload,
    cliente_id: finalClienteId,
    inizio: startISO,
    fine: endISO,
    data_solo: dateOnly
  };

  /**
   * Confronto fra due istanti ISO che possono avere formati diversi
   * (`...T08:30:00.000Z` da toISOString, `...T08:30:00+00:00` da Postgres).
   * Confrontarli come stringhe diceva sempre "cambiato": ogni salvataggio
   * riarmava il promemoria già inviato e rispediva la mail di modifica.
   */
  const stessoIstante = (a?: string | null, b?: string | null): boolean => {
    if (!a || !b) return false;
    const ta = new Date(a).getTime();
    const tb = new Date(b).getTime();
    if (Number.isNaN(ta) || Number.isNaN(tb)) return String(a) === String(b);
    return ta === tb;
  };

  // Impegno spostato in data/ora: il promemoria già inviato va riarmato, altrimenti
  // quello nuovo non arriverebbe più (il marcatore resta valorizzato).
  const orarioCambiato = Boolean(primaDellaModifica?.inizio) && !stessoIstante(primaDellaModifica?.inizio, startISO);
  if (orarioCambiato && payload.is_impegno) {
    rigaAggiornata.promemoria_inviato_il = null;
  }

  let aggiornamento = await supabase
    .from('appuntamenti')
    .update(rigaAggiornata)
    .eq('id', id)
    .select()
    .single();

  // Migrazione promemoria non applicata: si aggiorna senza le colonne nuove
  if (aggiornamento.error && /promemoria_minuti|promemoria_inviato_il/.test(aggiornamento.error.message)) {
    console.warn('Colonne promemoria assenti: esegui la migrazione 20261110140000_promemoria.sql');
    const { promemoria_minuti, promemoria_inviato_il, ...senzaPromemoria } = rigaAggiornata;
    aggiornamento = await supabase
      .from('appuntamenti')
      .update(senzaPromemoria)
      .eq('id', id)
      .select()
      .single();
  }

  const { data, error } = aggiornamento;

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
  //
  // Il cliente riceve UNA mail alla prenotazione e UNA di promemoria (dal cron).
  // La mail di "guida modificata" va spedita solo se qualcosa di concreto è cambiato
  // — data/ora, istruttore o veicolo — altrimenti salvare due note o cambiare una
  // preferenza generava un'altra mail identica al cliente.
  const istruttoreCambiato = Boolean(istruttorePrecedente && istruttorePrecedente !== payload.istruttore_id);
  const veicoloCambiato = Boolean(
    primaDellaModifica?.veicolo_id && primaDellaModifica.veicolo_id !== payload.veicolo_id
  );
  const modificaDaAvvisare = orarioCambiato || istruttoreCambiato || veicoloCambiato;

  let notificationSent = false;
  let emailError = null;
  if (data && payload.send_email && modificaDaAvvisare) {
    try {
      const emailRes = await sendConfirmationEmailAction(data.id, true);
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

  // 4. Web Push — solo i proprietari dei calendari coinvolti (nuovo e, se spostata,
  // vecchio istruttore). Chi ha fatto la modifica non viene mai avvisato.
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const nomeCliente = clientePrecedente
      ? `${clientePrecedente.cognome || ''} ${clientePrecedente.nome || ''}`.trim()
      : '';

    const giorno = format(startTime, 'EEE d MMM', { locale: it });
    const ora = format(startTime, 'HH:mm', { locale: it });

    const spostata = Boolean(
      istruttorePrecedente && istruttorePrecedente !== payload.istruttore_id
    );

    await notificaCambioCalendario({
      istruttoriCoinvolti: [payload.istruttore_id, istruttorePrecedente],
      attoreUserId: user?.id,
      payload: {
        title: spostata ? '🔀 Guida spostata' : '✏️ Guida modificata',
        body: `${nomeCliente ? `${nomeCliente} — ` : ''}${giorno} alle ${ora}`,
        url: '/calendar'
      },
    });
  } catch (err) {
    console.error('Web Push Error:', err);
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');
  revalidatePath('/');

  return { success: true, appointment: data, notificationSent, emailError };
}
