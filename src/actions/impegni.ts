'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { Impegno, TipoImpegno } from '@/lib/database.types';

export async function getTipiImpegnoAction() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tipi_impegno')
    .select('*')
    .is('eliminato_il', null)
    .order('nome');
  if (error) return { success: false, error: error.message };
  return { success: true, data: data as TipoImpegno[] };
}

export async function createTipoImpegnoAction(payload: { nome: string; durata_default?: number | null; note_default?: string | null }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('tipi_impegno').insert(payload).select().single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: data as TipoImpegno };
}

export async function createImpegnoAction(payload: {
  istruttore_id: string | null;
  tipo: string;
  data: string;
  ora_inizio: string;
  durata: number;
  note?: string | null;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('impegni')
    .insert({
      istruttore_id: payload.istruttore_id || null,
      tipo: payload.tipo,
      data: payload.data,
      ora_inizio: payload.ora_inizio,
      durata: payload.durata,
      note: payload.note || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating commitment:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true, impegno: data };
}

export async function updateImpegnoAction(id: string, payload: {
  istruttore_id: string | null;
  tipo: string;
  data: string;
  ora_inizio: string;
  durata: number;
  note?: string | null;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('impegni')
    .update({
      istruttore_id: payload.istruttore_id || null,
      tipo: payload.tipo,
      data: payload.data,
      ora_inizio: payload.ora_inizio,
      durata: payload.durata,
      note: payload.note || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating commitment:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true, impegno: data };
}

export async function deleteImpegnoAction(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('impegni')
    .update({ eliminato_il: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting commitment:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true };
}
