'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { TipoPatente } from '@/lib/database.types';

export async function createVeicoloAction(payload: {
  nome: string;
  targa: string;
  data_revisione: string;
  tipo_patente: TipoPatente;
  cambio_manuale: boolean;
  colore: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.from('veicoli').insert(payload).select().single();

  if (error) {
    console.error('Error creating vehicle:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true, veicolo: data };
}

export async function updateVeicoloAction(id: string, payload: {
  nome: string;
  targa: string;
  data_revisione: string;
  tipo_patente: TipoPatente;
  cambio_manuale: boolean;
  colore: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('veicoli')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating vehicle:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true, veicolo: data };
}

export async function deleteVeicoloAction(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from('veicoli').delete().eq('id', id);

  if (error) {
    console.error('Error deleting vehicle:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true };
}
