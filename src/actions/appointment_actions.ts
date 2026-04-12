'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { StatoAppuntamento } from '@/lib/database.types';

export async function deleteAppointmentAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('appuntamenti')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting appointment:', error.message);
    return { success: false, error: error.message };
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


