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
 * Broadcasts a push notification to ALL subscribed users,
 * excluding the user who performed the action (to avoid self-notifications).
 * This ensures admin, segreteria, and all instructors get notified on every change.
 */
export async function sendNotificationToAllUsers(excludeUserId: string | null, payload: { title: string, body: string, url?: string }) {
  if (!vapidPublicKey || !vapidPrivateKey) return;

  const { createClient: createAdminClient } = await import('@supabase/supabase-js');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return;

  const adminDb = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  // Fetch all subscriptions except the one belonging to the current user
  let query = adminDb.from('push_subscriptions').select('subscription, id, user_id');
  if (excludeUserId) {
    query = (query as any).neq('user_id', excludeUserId);
  }
  const { data: subscriptions } = await query;

  if (!subscriptions || subscriptions.length === 0) return;

  const promises = subscriptions.map(async (sub: any) => {
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        await adminDb.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        console.error('Error sending broadcast push:', error);
      }
    }
  });

  await Promise.all(promises);
}

/**
 * Checks if a given instructor ID belongs to Manuele Garzella.
 */
export async function isInstructorGarzella(instructorId: string): Promise<boolean> {
  const { createClient: createAdminClient } = await import('@supabase/supabase-js');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return false;

  const adminDb = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

  const { data: instructor, error } = await adminDb
    .from('istruttori')
    .select('nome, cognome')
    .eq('id', instructorId)
    .single();

  if (error || !instructor) return false;

  return (
    instructor.nome?.toLowerCase() === 'manuele' &&
    instructor.cognome?.toLowerCase() === 'garzella'
  );
}
