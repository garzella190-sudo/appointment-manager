'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { StatoAppuntamento } from '@/lib/database.types';

export async function deleteAppointmentAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('appuntamenti').delete().eq('id', id);
  
  if (error) {
    console.error('Error deleting appointment:', error.message);
    return { success: false, error: error.message };
  }

  // Release Slot
  try {
    await supabase
      .from('time_slots')
      .update({ is_available: true, appointment_id: null })
      .eq('appointment_id', id);
  } catch (e) {}

  revalidatePath('/calendar');
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

  // Release Slot
  try {
    await supabase
      .from('time_slots')
      .update({ is_available: true, appointment_id: null })
      .eq('appointment_id', id);
  } catch (e) {}

  revalidatePath('/calendar');
  return { success: true };
}

/**
 * Sanity Check: Syncs all active appointments to time_slots table.
 * Deletes invalid slots and creates missing ones.
 */
export async function syncAppointmentsToSlotsAction() {
  const supabase = await createClient();
  
  // 1. Fetch all appointments
  const { data: apts } = await supabase
    .from('appuntamenti')
    .select('*')
    .neq('stato', 'annullato');

  if (!apts) return { success: false, error: 'No appointments found' };

  // 2. Clear all existing slots assigned to appointments (to rebuild cleanly)
  await supabase.from('time_slots').update({ is_available: true, appointment_id: null }).not('appointment_id', 'is', null);

  // 3. Re-assign
  for (const apt of apts) {
    const startISO = new Date(apt.data).toISOString();
    const endISO = new Date(new Date(apt.data).getTime() + (apt.durata || 60) * 60000).toISOString();
    
    await supabase.from('time_slots').upsert({
      start_time: startISO,
      end_time: endISO,
      instructor_id: apt.istruttore_id,
      vehicle_id: apt.veicolo_id,
      is_available: false,
      appointment_id: apt.id
    }, { onConflict: 'start_time, instructor_id' });
  }

  return { success: true, count: apts.length };
}
