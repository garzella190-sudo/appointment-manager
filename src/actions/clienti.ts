'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { TipoCambio } from '@/lib/database.types';

export async function createClienteAction(payload: {
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
  patente_richiesta_id: string | null;
  preferenza_cambio: TipoCambio | null;
  riceve_email: boolean;
  riceve_whatsapp: boolean;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.from('clienti').insert(payload).select('id').single();

  if (error) {
    console.error('Error creating client:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/clienti');

  return { success: true, id: data.id };
}

export async function updateClienteAction(id: string, payload: {
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
  patente_richiesta_id: string | null;
  preferenza_cambio: TipoCambio | null;
  riceve_email: boolean;
  riceve_whatsapp: boolean;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clienti')
    .update(payload)
    .eq('id', id)
    .select('id')
    .single();

  if (error) {
    console.error('Error updating client:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/clienti');
  revalidatePath(`/clienti/${id}`);

  return { success: true, id: data.id };
}

export async function deleteClienteAction(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('clienti')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting client:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/clienti');

  return { success: true };
}
export async function toggleProntoEsameAction(id: string, pronto: boolean, sessioneId?: string | null) {
  const supabase = await createClient();

  const updatePayload: any = { 
    pronto_esame: pronto,
    data_pronto_esame: pronto ? new Date().toISOString() : null 
  };

  if (sessioneId !== undefined) {
    updatePayload.sessione_esame_id = sessioneId;
  }
  
  if (pronto) {
    const { data: { user } } = await supabase.auth.getUser();
    const userIstruttoreId = user?.user_metadata?.istruttore_id || null;
    updatePayload.istruttore_pronto_id = userIstruttoreId;
  } else {
    updatePayload.istruttore_pronto_id = null;
  }

  const { data, error } = await supabase
    .from('clienti')
    .update(updatePayload)
    .eq('id', id)
    .select('id')
    .single();

  if (error) {
    console.error('Error updating pronto_esame:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/clienti');
  revalidatePath('/esami');
  revalidatePath(`/clienti/${id}`);

  return { success: true, id: data.id };
}

export async function archiveClienteAction(id: string, archiviato: boolean) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clienti')
    .update({ archiviato })
    .eq('id', id)
    .select('id')
    .single();

  if (error) {
    console.error('Error archiving client:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/clienti');
  revalidatePath(`/clienti/${id}`);
  revalidatePath('/esami');

  return { success: true, id: data.id };
}

export async function registraEsitoEsameAction(
  clienteId: string, 
  sessioneId: string, 
  esito: 'PROMOSSO' | 'RESPINTO' | 'ASSENTE'
) {
  const supabase = await createClient();

  // 1. Fetch session details
  const { data: sessionData, error: sessionError } = await supabase
    .from('sessioni_esame')
    .select('*')
    .eq('id', sessioneId)
    .single();

  if (sessionError || !sessionData) {
    return { success: false, error: 'Seduta non trovata' };
  }

  // 2. Update Cliente
  let updatePayload: any = {};
  if (esito === 'PROMOSSO') {
    updatePayload = { archiviato: true, pronto_esame: false, sessione_esame_id: null, bocciato: false };
  } else if (esito === 'RESPINTO') {
    updatePayload = { pronto_esame: true, sessione_esame_id: null, bocciato: true };
  } else if (esito === 'ASSENTE') {
    updatePayload = { pronto_esame: true, sessione_esame_id: null, bocciato: false };
  }

  const { error: clienteError } = await supabase
    .from('clienti')
    .update(updatePayload)
    .eq('id', clienteId);

  if (clienteError) {
    return { success: false, error: clienteError.message };
  }

  // 3. Create Storico record (Appuntamento)
  const startDateStr = `${sessionData.data}T${sessionData.ora_inizio || '08:30'}`;
  const startDate = new Date(startDateStr);
  const endDate = new Date(startDate.getTime() + (sessionData.durata || 60) * 60000);

  const { error: aptError } = await supabase.from('appuntamenti').insert({
    cliente_id: clienteId,
    sessione_esame_id: sessioneId,
    data_solo: sessionData.data,
    data: startDate.toISOString(),
    inizio: startDate.toISOString(),
    fine: endDate.toISOString(),
    durata: sessionData.durata || 60,
    note: `ESITO ESAME: ${esito}`,
    stato: esito === 'ASSENTE' ? 'annullato' : 'completato',
    is_impegno: false,
    importo: 0,
    istruttore_id: null, // intentionally null to prevent rendering in calendar views
    veicolo_id: null
  });

  if (aptError) {
    console.error('Error creating esito appointment:', aptError.message);
  }

  revalidatePath('/calendar');
  revalidatePath('/clienti');
  revalidatePath(`/clienti/${clienteId}`);
  revalidatePath('/esami');

  return { success: true };
}

export async function deleteSessioneEsameAction(sessionId: string) {
  const supabase = await createClient();

  // 1. Unlink candidates
  const { error: clientiError } = await supabase
    .from('clienti')
    .update({ sessione_esame_id: null })
    .eq('sessione_esame_id', sessionId);
    
  if (clientiError) {
    return { success: false, error: 'Errore nello scollegare i clienti: ' + clientiError.message };
  }

  // 2. Delete linked appointments (the instructor blocks in the calendar, and any esito history blocks)
  const { error: aptError } = await supabase
    .from('appuntamenti')
    .delete()
    .eq('sessione_esame_id', sessionId);

  if (aptError) {
    return { success: false, error: 'Errore nell\'eliminazione degli appuntamenti collegati: ' + aptError.message };
  }

  // 3. Delete the session
  const { error: sessionError } = await supabase
    .from('sessioni_esame')
    .delete()
    .eq('id', sessionId);

  if (sessionError) {
    return { success: false, error: 'Errore nell\'eliminazione della seduta: ' + sessionError.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/esami');
  revalidatePath('/clienti');

  return { success: true };
}
