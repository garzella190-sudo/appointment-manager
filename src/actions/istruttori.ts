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
  veicolo_id?: string | null;
}) {
  const supabase = await createClient();

  let targetPhone = payload.telefono;
  // Se il telefono è vuoto o ha il placeholder, usiamo stringa vuota invece di null
  // perché la tabella 'trainers' ha un vincolo NOT NULL sulla colonna 'phone'
  if (!targetPhone || targetPhone === "" || targetPhone === "Da inserire") {
    targetPhone = "";
  }

  const { data, error } = await supabase
    .from('istruttori')
    .insert({
      nome: payload.nome,
      cognome: payload.cognome,
      telefono: targetPhone,
      email: payload.email,
      colore: payload.colore,
      patenti_abilitate: payload.patenti_abilitate,
      veicolo_id: payload.veicolo_id || null,
    })
    .select()
    .single();

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
  veicolo_id?: string | null;
}) {
  const supabase = await createClient();

  let targetPhone = payload.telefono;
  if (!targetPhone || targetPhone === "" || targetPhone === "Da inserire") {
    targetPhone = "";
  }

  const { data, error } = await supabase
    .from('istruttori')
    .update({
      nome: payload.nome,
      cognome: payload.cognome,
      telefono: targetPhone,
      email: payload.email,
      colore: payload.colore,
      patenti_abilitate: payload.patenti_abilitate,
      veicolo_id: payload.veicolo_id || null,
    })
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
  const now = new Date().toISOString();

  // Soft delete associated appointments
  await supabase
    .from('appuntamenti')
    .update({ eliminato_il: now })
    .eq('istruttore_id', id);

  // Soft delete the instructor
  const { error } = await supabase
    .from('istruttori')
    .update({ eliminato_il: now })
    .eq('id', id);

  if (error) {
    console.error('Error soft-deleting instructor:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true };
}
