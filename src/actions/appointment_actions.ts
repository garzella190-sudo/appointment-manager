'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { StatoAppuntamento } from '@/lib/database.types';
import { sendConfirmationEmailAction, sendCancellationEmailAction } from './notifications';
import { sendNotificationToInstructor } from '@/lib/pushHelper';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

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
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserIstruttoreId = session?.user?.user_metadata?.istruttore_id;
      if (currentUserIstruttoreId !== aptToDelete.istruttore_id) {
        const timeStr = format(new Date(aptToDelete.data), 'dd/MM HH:mm', { locale: it });
        const clientName = (aptToDelete.clienti as any)?.nome !== 'UFFICIO' ? `${(aptToDelete.clienti as any)?.nome} ${(aptToDelete.clienti as any)?.cognome}` : 'Impegno';
        await sendNotificationToInstructor(aptToDelete.istruttore_id, {
          title: 'Guida Eliminata',
          body: `L'appuntamento per ${clientName} del ${timeStr} è stato eliminato.`,
          url: '/'
        });
      }
      
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
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserIstruttoreId = session?.user?.user_metadata?.istruttore_id;
    
    // We need to fetch the instructor_id and data to send the push
    const { data: fullApt } = await supabase.from('appuntamenti').select('istruttore_id, data, clienti(nome, cognome)').eq('id', id).single();
    if (fullApt && currentUserIstruttoreId !== fullApt.istruttore_id) {
        const timeStr = format(new Date(fullApt.data), 'dd/MM HH:mm', { locale: it });
        const clientName = (fullApt.clienti as any)?.nome !== 'UFFICIO' ? `${(fullApt.clienti as any)?.nome} ${(fullApt.clienti as any)?.cognome}` : 'Impegno';
        await sendNotificationToInstructor(fullApt.istruttore_id, {
          title: 'Guida Annullata',
          body: `L'appuntamento per ${clientName} del ${timeStr} è stato annullato (con penale).`,
          url: '/'
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


