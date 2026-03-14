'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { TipoCambio } from '@/lib/database.types';

export async function createClienteAction(payload: {
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
  patente_richiesta_id: string | null;
  preferenza_cambio: TipoCambio | null;
  riceve_email: boolean;
  riceve_whatsapp: boolean;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.from('clienti').insert(payload).select('id').single();

  if (error) {
    console.error('Error creating client:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/clienti');

  return { success: true, id: data.id };
}

export async function updateClienteAction(id: string, payload: {
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
  patente_richiesta_id: string | null;
  preferenza_cambio: TipoCambio | null;
  riceve_email: boolean;
  riceve_whatsapp: boolean;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clienti')
    .update(payload)
    .eq('id', id)
    .select('id')
    .single();

  if (error) {
    console.error('Error updating client:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/clienti');
  revalidatePath(`/clienti/${id}`);

  return { success: true, id: data.id };
}

export async function deleteClienteAction(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from('clienti').delete().eq('id', id);

  if (error) {
    console.error('Error deleting client:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/clienti');

  return { success: true };
}
