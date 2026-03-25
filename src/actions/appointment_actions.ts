'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { StatoAppuntamento } from '@/lib/database.types';

export async function deleteAppointmentAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('appuntamenti')
    .update({ eliminato_il: new Date().toISOString() })
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
  const { error } = await supabase
    .from('appuntamenti')
    .update({ stato: 'annullato' })
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


