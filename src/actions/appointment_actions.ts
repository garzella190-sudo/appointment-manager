'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendCancellationEmailAction } from './notifications';
import { notificaCambioCalendario } from '@/lib/pushHelper';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

/** Riga di appuntamento arricchita con i dati del cliente (serve solo per i testi delle notifiche). */
interface RigaAppuntamento {
  id?: string;
  data: string;
  istruttore_id: string | null;
  durata?: number;
  clienti?: { nome: string | null; cognome: string | null; email?: string | null } | { nome: string | null; cognome: string | null; email?: string | null }[] | null;
}

/** "cognome nome", oppure "Impegno" per gli slot di ufficio. */
function nomeCliente(riga: RigaAppuntamento | null | undefined): string {
  const cliente = Array.isArray(riga?.clienti) ? riga?.clienti[0] : riga?.clienti;
  if (!cliente) return 'Guida';
  if (cliente.nome === 'UFFICIO') return cliente.cognome || 'Impegno';
  return `${cliente.cognome || ''} ${cliente.nome || ''}`.trim() || 'Guida';
}

/** "mer 4 giu alle 15:00" */
function quando(dataISO: string): string {
  try {
    return `${format(new Date(dataISO), 'EEE d MMM', { locale: it })} alle ${format(new Date(dataISO), 'HH:mm')}`;
  } catch {
    return '';
  }
}

/**
 * Nota sulle notifiche: `notificaCambioCalendario` ricava da sé l'autore della modifica
 * dalla sessione (cookie) e non lo avvisa. Qui non serve passare nulla.
 */

export async function deleteAppointmentAction(id: string) {
  const supabase = await createClient();
  const { data: aptToDelete } = await supabase
    .from('appuntamenti')
    .select('istruttore_id, data, durata, clienti(nome, cognome, email)')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('appuntamenti')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting appointment:', error.message);
    return { success: false, error: error.message };
  }

  try {
    if (aptToDelete) {
      // Notifica PUSH: la riceve il proprietario del calendario, mai chi ha eliminato.
      await notificaCambioCalendario({
        istruttoriCoinvolti: [aptToDelete.istruttore_id],
        payload: {
          title: '🗑️ Guida eliminata',
          body: `${nomeCliente(aptToDelete)} — ${quando(aptToDelete.data)}`,
          url: '/calendar'
        },
      });
      
      // Email to client
      if (aptToDelete.clienti) {
        await sendCancellationEmailAction(aptToDelete);
      }
    }
  } catch (e) {
    console.error('Push error:', e);
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');
  revalidatePath('/'); // Refresh Agenda
  return { success: true };
}

export async function cancelAppointmentAction(id: string) {
  const supabase = await createClient();
  
  // Need to fetch current details to calculate penalty
  const { data: apt, error: fetchErr } = await supabase
    .from('appuntamenti')
    .select('durata, note, importo, patente_id')
    .eq('id', id)
    .single();
    
  if (fetchErr) {
    return { success: false, error: fetchErr.message };
  }

  let penalty = 25;
  if (apt.durata === 30) penalty = 25;
  else if (apt.durata === 60) penalty = 50;
  
  // Check if it's an exam session
  if (apt.note && apt.note.toLowerCase().includes('esame')) {
    penalty = 120;
  }
  
  const currentImporto = apt.importo || 0;
  const newImporto = currentImporto + penalty;

  const { error } = await supabase
    .from('appuntamenti')
    .update({ 
      stato: 'annullato', 
      annullato: true, 
      importo: newImporto 
    })
    .eq('id', id);
  
  if (error) {
    console.error('Error cancelling appointment:', error.message);
    return { success: false, error: error.message };
  }

  try {
    // We need to fetch the instructor_id and data to send the push
    const { data: fullApt } = await supabase
      .from('appuntamenti')
      .select('istruttore_id, data, clienti(nome, cognome)')
      .eq('id', id)
      .single();

    if (fullApt) {
      await notificaCambioCalendario({
        istruttoriCoinvolti: [fullApt.istruttore_id],
        payload: {
          title: '🚫 Guida annullata',
          body: `${nomeCliente(fullApt)} — ${quando(fullApt.data)} (con penale)`,
          url: '/calendar'
        },
      });
    }
  } catch (e) {
    console.error('Push error:', e);
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');
  revalidatePath('/'); // Refresh Agenda
  return { success: true };
}

/**
 * Notifica di uno spostamento fatto direttamente sul calendario (drag & drop) o
 * da una seduta d'esame: quelle modifiche non passano dalle action di creazione,
 * quindi senza questa chiamata nessuno riceveva l'avviso.
 */
export async function notificaSpostamentoAction(
  appointmentIds: string[],
  azione: 'spostamento' | 'aggiornamento' = 'spostamento'
) {
  const ids = [...new Set((appointmentIds || []).filter(Boolean))];
  if (ids.length === 0) return { success: false };

  const supabase = await createClient();
  const { data } = await supabase
    .from('appuntamenti')
    .select('id, data, istruttore_id, durata, clienti(nome, cognome)')
    .in('id', ids);

  const righe = (data || []) as unknown as RigaAppuntamento[];
  if (righe.length === 0) return { success: false };

  try {
    const prima = righe[0];
    const altre = righe.length > 1 ? ` (+${righe.length - 1})` : '';

    await notificaCambioCalendario({
      istruttoriCoinvolti: righe.map((riga) => riga.istruttore_id),
      payload: {
        title: azione === 'spostamento' ? '🔀 Guida spostata' : '✏️ Guida aggiornata',
        body: `${nomeCliente(prima)}${altre} — ${quando(prima.data)}`,
        url: '/calendar'
      },
    });
  } catch (e) {
    console.error('Push error (spostamento):', e);
  }

  return { success: true };
}

/** Notifica per una seduta d'esame modificata o spostata. */
export async function notificaSessioneEsameAction(
  sessioneId: string,
  azione: 'spostamento' | 'aggiornamento' = 'aggiornamento'
) {
  if (!sessioneId) return { success: false };

  const supabase = await createClient();
  const { data: sessione } = await supabase
    .from('sessioni_esame')
    .select('id, nome, data, ora_inizio, istruttori_ids')
    .eq('id', sessioneId)
    .maybeSingle();

  if (!sessione) return { success: false };

  try {
    const giorno = sessione.data
      ? format(new Date(sessione.data), 'EEE d MMM', { locale: it })
      : '';
    const ora = (sessione.ora_inizio || '').slice(0, 5);

    await notificaCambioCalendario({
      istruttoriCoinvolti: sessione.istruttori_ids || [],
      payload: {
        title: azione === 'spostamento' ? '🔀 Seduta d\'esame spostata' : '🎓 Seduta d\'esame aggiornata',
        body: `${sessione.nome || 'Seduta d\'esame'} — ${giorno}${ora ? ` alle ${ora}` : ''}`,
        url: '/calendar'
      },
    });
  } catch (e) {
    console.error('Push error (sessione esame):', e);
  }

  return { success: true };
}

export async function updateAppointmentNoteAction(id: string, note: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('appuntamenti')
    .update({ note })
    .eq('id', id);
  
  if (error) {
    console.error('Error updating appointment note:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');
  revalidatePath('/'); // Refresh Agenda
  return { success: true };
}

