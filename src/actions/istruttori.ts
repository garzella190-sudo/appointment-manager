'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { TipoPatente } from '@/lib/database.types';

export async function createIstruttoreAction(payload: {
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
  patenti_abilitate: TipoPatente[];
  colore: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.from('istruttori').insert(payload).select().single();

  if (error) {
    console.error('Error creating instructor:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true, istruttore: data };
}

export async function updateIstruttoreAction(id: string, payload: {
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
  patenti_abilitate: TipoPatente[];
  colore: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('istruttori')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating instructor:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true, istruttore: data };
}

export async function deleteIstruttoreAction(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from('istruttori').delete().eq('id', id);

  if (error) {
    console.error('Error deleting instructor:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true };
}
