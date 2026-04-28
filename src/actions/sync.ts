'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { createAppointmentAction, updateAppointmentAction } from './appointments';
import { deleteAppointmentAction, cancelAppointmentAction } from './appointment_actions';
import { createClienteAction, updateClienteAction, deleteClienteAction } from './clienti';

export async function processOfflineSyncAction(queueItems: any[]) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  const istruttoreId = session?.user?.user_metadata?.istruttore_id;

  const results = [];

  for (const item of queueItems) {
    try {
      const payloadWithMeta = {
        ...item.payload,
        _offline_user_id: userId,
        _offline_istruttore_id: istruttoreId
      };

      if (item.entity_type === 'appuntamento') {
        const payload = payloadWithMeta;
        
        if (item.action === 'create') {
          // We can use the existing action which already does overlap checks
          const res = await createAppointmentAction(payload);
          
          if (!res.success) {
            // CONFLICT DETECTED!
            // We save it to sync_conflicts instead of throwing an error
            await supabase.from('sync_conflicts').insert({
              entity_type: 'appuntamento',
              action: 'create',
              payload: payload,
              conflict_reason: res.error || 'Conflitto sconosciuto'
            });
            results.push({ id: item.id, status: 'conflict' });
          } else {
            results.push({ id: item.id, status: 'success' });
          }
        } 
        else if (item.action === 'update') {
          const res = await updateAppointmentAction(payload.id, payload.data);
          if (!res.success) {
            await supabase.from('sync_conflicts').insert({
              entity_type: 'appuntamento',
              action: 'update',
              payload: payload,
              conflict_reason: res.error || 'Conflitto sconosciuto'
            });
            results.push({ id: item.id, status: 'conflict' });
          } else {
            results.push({ id: item.id, status: 'success' });
          }
        }
        else if (item.action === 'delete') {
          const res = await deleteAppointmentAction(payload.id);
          if (!res.success) {
            await supabase.from('sync_conflicts').insert({
              entity_type: 'appuntamento',
              action: 'delete',
              payload: payload,
              conflict_reason: res.error || 'Conflitto sconosciuto'
            });
            results.push({ id: item.id, status: 'conflict' });
          } else {
            results.push({ id: item.id, status: 'success' });
          }
        }
        else if (item.action === 'cancel') {
          const res = await cancelAppointmentAction(payload.id);
          if (!res.success) {
            await supabase.from('sync_conflicts').insert({
              entity_type: 'appuntamento',
              action: 'cancel',
              payload: payload,
              conflict_reason: res.error || 'Conflitto sconosciuto'
            });
            results.push({ id: item.id, status: 'conflict' });
          } else {
            results.push({ id: item.id, status: 'success' });
          }
        }
      } else if (item.entity_type === 'cliente') {
        const payload = payloadWithMeta;
        if (item.action === 'create') {
          const res = await createClienteAction(payload);
          if (!res.success) {
            await supabase.from('sync_conflicts').insert({ entity_type: 'cliente', action: 'create', payload, conflict_reason: res.error || 'Errore' });
            results.push({ id: item.id, status: 'conflict' });
          } else { results.push({ id: item.id, status: 'success' }); }
        } else if (item.action === 'update') {
          const res = await updateClienteAction(payload.id, payload.data);
          if (!res.success) {
            await supabase.from('sync_conflicts').insert({ entity_type: 'cliente', action: 'update', payload, conflict_reason: res.error || 'Errore' });
            results.push({ id: item.id, status: 'conflict' });
          } else { results.push({ id: item.id, status: 'success' }); }
        } else if (item.action === 'delete') {
          const res = await deleteClienteAction(payload.id);
          if (!res.success) {
            await supabase.from('sync_conflicts').insert({ entity_type: 'cliente', action: 'delete', payload, conflict_reason: res.error || 'Errore' });
            results.push({ id: item.id, status: 'conflict' });
          } else { results.push({ id: item.id, status: 'success' }); }
        }
      } else {
         results.push({ id: item.id, status: 'failed', error: 'Unknown entity type' });
      }
    } catch (e: any) {
      console.error('Error syncing item:', item.id, e);
      results.push({ id: item.id, status: 'failed', error: e.message });
    }
  }

  revalidatePath('/');
  revalidatePath('/calendar');
  revalidatePath('/gestione');

  return { success: true, results };
}
