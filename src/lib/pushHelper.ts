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

  const supabase = await createClient();

  // First, we need to find the user_id corresponding to this istruttore_id.
  // We assume that the user's metadata contains istruttore_id.
  // The 'push_subscriptions' table is linked to auth.users.
  // Unfortunately, we can't easily query auth.users by metadata from the client library without service role.
  // However, we can use the service role client.
  
  const adminSupabase = await createClient(); // We need a way to query profiles or auth users.
  // In a real app, there's usually a `profili` or `users` public table.
  // Let's check if the current instructor has an associated user ID by querying push_subscriptions directly?
  // No, push_subscriptions only has user_id. We must find who the instructor is.
  
  // Wait, if we don't have a direct link from istruttori to users in a public table, we might need a workaround.
  // Let's create a server-side Supabase client with SERVICE_ROLE to query auth.users
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
        // Subscription has expired or is no longer valid, delete it
        await adminDb.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        console.error('Error sending push notification:', error);
      }
    }
  });

  await Promise.all(promises);
}
