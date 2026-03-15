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
  default_vehicle_id: string | null;
}) {
  const supabase = await createClient();

  // Sanitizzazione server-side
  let targetVehicleId = payload.default_vehicle_id;
  if (targetVehicleId === "" || targetVehicleId === "Nessuno") {
    targetVehicleId = null;
  }

  let targetPhone = payload.telefono;
  // Se il telefono è vuoto o ha il placeholder, usiamo stringa vuota invece di null
  // perché la tabella 'trainers' ha un vincolo NOT NULL sulla colonna 'phone'
  if (!targetPhone || targetPhone === "" || targetPhone === "Da inserire") {
    targetPhone = "";
  }

  const { data, error } = await supabase
    .from('trainers')
    .insert({
      name: `${payload.nome} ${payload.cognome}`.trim(),
      phone: targetPhone,
      email: payload.email,
      color: payload.colore,
      patenti_abilitate: payload.patenti_abilitate,
      default_vehicle_id: targetVehicleId,
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
  default_vehicle_id: string | null;
}) {
  const supabase = await createClient();

  // Sanitizzazione server-side
  let targetVehicleId = payload.default_vehicle_id;
  if (targetVehicleId === "" || targetVehicleId === "Nessuno") {
    targetVehicleId = null;
  }

  let targetPhone = payload.telefono;
  if (!targetPhone || targetPhone === "" || targetPhone === "Da inserire") {
    targetPhone = "";
  }

  const { data, error } = await supabase
    .from('trainers')
    .update({
      name: `${payload.nome} ${payload.cognome}`.trim(),
      phone: targetPhone,
      email: payload.email,
      color: payload.colore,
      patenti_abilitate: payload.patenti_abilitate,
      default_vehicle_id: targetVehicleId,
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

  const { error } = await supabase.from('trainers').delete().eq('id', id);

  if (error) {
    console.error('Error deleting instructor:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true };
}
