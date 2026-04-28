'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { createAppointmentAction, updateAppointmentAction } from './appointments';
import { deleteAppointmentAction, cancelAppointmentAction } from './appointment_actions';
import { createClienteAction, updateClienteAction, deleteClienteAction } from './clienti';

export async function discardConflictAction(conflictId: string) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return { success: false, error: 'Non autorizzato' };

  const { error } = await supabase
    .from('sync_conflicts')
    .update({ 
      resolved: true, 
      resolved_at: new Date().toISOString(),
      resolved_by: session.user.id
    })
    .eq('id', conflictId);

  if (error) return { success: false, error: error.message };
  
  revalidatePath('/gestione/conflitti');
  return { success: true };
}

export async function forceResolveConflictAction(conflictId: string) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return { success: false, error: 'Non autorizzato' };

  // Get conflict
  const { data: conflict, error: fetchErr } = await supabase
    .from('sync_conflicts')
    .select('*')
    .eq('id', conflictId)
    .single();

  if (fetchErr || !conflict) return { success: false, error: 'Conflitto non trovato' };

  // Forzare significa che applichiamo l'azione saltando i controlli normali?
  // I server actions esistenti hanno i controlli integrati (overlap).
  // Per forzare, dobbiamo eseguire l'operazione bypassando il blocco.
  // Poiché i nostri action attuali non hanno un flag "force", modificheremo direttamente il DB.
  
  let success = false;
  let forceError = null;

  try {
    if (conflict.entity_type === 'appuntamento') {
      const p = conflict.payload;
      if (conflict.action === 'create') {
        // Find overlapping and delete them first (to "force")
        // This is complex. Alternatively, we just insert and ignore overlap? 
        // Our DB might not have constraints blocking it, the block was in the Action.
        const { error } = await supabase.from('appuntamenti').insert({
          cliente_id: p.cliente_id,
          istruttore_id: p.istruttore_id,
          veicolo_id: p.veicolo_id,
          inizio: p.data,
          fine: new Date(new Date(p.data).getTime() + p.durata * 60000).toISOString(),
          data_solo: p.data_solo || p.data.split('T')[0],
          durata: p.durata,
          stato: p.stato,
          note: p.note
        });
        if (error) throw error;
        success = true;
      } else if (conflict.action === 'update') {
         const { error } = await supabase.from('appuntamenti').update(p.data).eq('id', p.id);
         if (error) throw error;
         success = true;
      } else if (conflict.action === 'delete') {
         const { error } = await supabase.from('appuntamenti').delete().eq('id', p.id);
         if (error) throw error;
         success = true;
      } else if (conflict.action === 'cancel') {
         const { error } = await supabase.from('appuntamenti').update({ stato: 'annullato', annullato: true }).eq('id', p.id);
         if (error) throw error;
         success = true;
      }
    } else if (conflict.entity_type === 'cliente') {
      const p = conflict.payload;
      if (conflict.action === 'create') {
         const { error } = await supabase.from('clienti').insert(p);
         if (error) throw error;
         success = true;
      } else if (conflict.action === 'update') {
         const { error } = await supabase.from('clienti').update(p.data).eq('id', p.id);
         if (error) throw error;
         success = true;
      } else if (conflict.action === 'delete') {
         const { error } = await supabase.from('clienti').delete().eq('id', p.id);
         if (error) throw error;
         success = true;
      }
    }

    if (success) {
      await supabase.from('sync_conflicts').update({ 
        resolved: true, 
        resolved_at: new Date().toISOString(),
        resolved_by: session.user.id
      }).eq('id', conflictId);
      
      revalidatePath('/gestione/conflitti');
      revalidatePath('/calendar');
      return { success: true };
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }
  
  return { success: false, error: 'Azione non supportata' };
}
