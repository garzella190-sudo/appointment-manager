'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { Impegno, TipoImpegno } from '@/lib/database.types';
import { sendNotificationToInstructor, isInstructorGarzella } from '@/lib/pushHelper';
import { format } from 'date-fns';

export async function getTipiImpegnoAction() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tipi_impegno')
    .select('*')
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

  try {
    if (payload.istruttore_id) {
      const isGarzella = await isInstructorGarzella(payload.istruttore_id);
      if (isGarzella) {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserIstruttoreId = session?.user?.user_metadata?.istruttore_id;
        if (currentUserIstruttoreId !== payload.istruttore_id) {
          const dateFormatted = format(new Date(payload.data), 'dd/MM');
          const timeFormatted = payload.ora_inizio.substring(0, 5);
          await sendNotificationToInstructor(payload.istruttore_id, {
            title: '📅 Nuovo Impegno Inserito',
            body: `${payload.tipo} — ${dateFormatted} alle ${timeFormatted}`,
            url: '/'
          });
        }
      }
    }
  } catch (err) {
    console.error('Push notification error in createImpegnoAction:', err);
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

  try {
    if (payload.istruttore_id) {
      const isGarzella = await isInstructorGarzella(payload.istruttore_id);
      if (isGarzella) {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserIstruttoreId = session?.user?.user_metadata?.istruttore_id;
        if (currentUserIstruttoreId !== payload.istruttore_id) {
          const dateFormatted = format(new Date(payload.data), 'dd/MM');
          const timeFormatted = payload.ora_inizio.substring(0, 5);
          await sendNotificationToInstructor(payload.istruttore_id, {
            title: '✏️ Impegno Modificato',
            body: `${payload.tipo} — ${dateFormatted} alle ${timeFormatted}`,
            url: '/'
          });
        }
      }
    }
  } catch (err) {
    console.error('Push notification error in updateImpegnoAction:', err);
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true, impegno: data };
}

export async function deleteImpegnoAction(id: string) {
  const supabase = await createClient();

  const { data: impegnoToDelete } = await supabase
    .from('impegni')
    .select('istruttore_id, data, ora_inizio, tipo')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('impegni')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting commitment:', error.message);
    return { success: false, error: error.message };
  }

  try {
    if (impegnoToDelete && impegnoToDelete.istruttore_id) {
      const isGarzella = await isInstructorGarzella(impegnoToDelete.istruttore_id);
      if (isGarzella) {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserIstruttoreId = session?.user?.user_metadata?.istruttore_id;
        if (currentUserIstruttoreId !== impegnoToDelete.istruttore_id) {
          const dateFormatted = format(new Date(impegnoToDelete.data), 'dd/MM');
          const timeFormatted = impegnoToDelete.ora_inizio.substring(0, 5);
          await sendNotificationToInstructor(impegnoToDelete.istruttore_id, {
            title: '🗑️ Impegno Eliminato',
            body: `${impegnoToDelete.tipo} del ${dateFormatted} alle ${timeFormatted} è stato eliminato.`,
            url: '/'
          });
        }
      }
    }
  } catch (err) {
    console.error('Push notification error in deleteImpegnoAction:', err);
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true };
}

export async function deleteImpegniBySessionAction(sessioneId: string) {
  const supabase = await createClient();

  // Cerchiamo impegni che contengono il riferimento [SEDUTA_ID:uuid] nelle note
  const { error } = await supabase
    .from('appuntamenti')
    .delete()
    .ilike('note', `%[SEDUTA_ID:${sessioneId}]%`);

  if (error) {
    console.error('Error deleting session commitments:', error.message);
    return { success: false, error: error.message };
  }

  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true };
}
