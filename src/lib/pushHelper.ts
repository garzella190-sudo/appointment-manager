import webpush from 'web-push';
import { createClient } from '@/utils/supabase/server';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:support@autoscuolatoscana.it',
    vapidPublicKey,
    vapidPrivateKey
  );
} else {
  console.warn('VAPID keys not configured. Web Push notifications are disabled.');
}

export async function sendNotificationToInstructor(instructorId: string, payload: { title: string, body: string, url?: string }) {
  if (!vapidPublicKey || !vapidPrivateKey) return;

  const { createClient: createAdminClient } = await import('@supabase/supabase-js');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return;
  
  const adminDb = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
  
  // Find the user who has this istruttore_id in their raw_user_meta_data
  const { data: usersData, error: usersError } = await adminDb.auth.admin.listUsers();
  if (usersError || !usersData?.users) return;
  
  const targetUser = usersData.users.find(u => u.user_metadata?.istruttore_id === instructorId);
  if (!targetUser) return; // Instructor hasn't logged in or linked account

  // Now find their push subscriptions
  const { data: subscriptions } = await adminDb
    .from('push_subscriptions')
    .select('subscription, id')
    .eq('user_id', targetUser.id);

  if (!subscriptions || subscriptions.length === 0) return;

  // Send push notification to all devices
  const promises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        await adminDb.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        console.error('Error sending push notification:', error);
      }
    }
  });

  await Promise.all(promises);
}

/**
 * Notifica PUSH **per utente**: avvisa SOLO gli istruttori il cui calendario è stato toccato,
 * e mai chi ha compiuto l'azione.
 *
 * Regole richieste:
 * - la segreteria modifica una guida di Francesco  → notifica solo Francesco
 * - Manuele prenota una guida sul calendario di Francesco → notifica solo Francesco
 * - Manuele prenota una guida sul proprio calendario → nessuna notifica
 *
 * `destinatari` contiene gli istruttori coinvolti (per uno spostamento: nuovo + vecchio
 * istruttore); i duplicati e l'autore dell'azione vengono scartati.
 * Restituisce gli id degli istruttori a cui la notifica è stata effettivamente tentata.
 */
export async function notificaGuidaAgliIstruttori(params: {
  destinatari: (string | null | undefined)[];
  attoreIstruttoreId?: string | null;
  payload: { title: string; body: string; url?: string };
}): Promise<string[]> {
  const attore = params.attoreIstruttoreId || null;

  const destinatari = [...new Set(params.destinatari.filter((id): id is string => !!id))]
    .filter(id => id !== attore);

  for (const instructorId of destinatari) {
    await sendNotificationToInstructor(instructorId, params.payload);
  }

  return destinatari;
}
