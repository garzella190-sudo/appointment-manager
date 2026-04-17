import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendReminderEmailAction } from '@/actions/notifications';
import { startOfDay, endOfDay } from 'date-fns';

// Opt out of caching for cron routes
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Optionale: Vercel inietta questo header quando fa scattare il cron. 
  // È una best practice validarlo, se hai CRON_SECRET nel file .env (in Vercel lo metti nelle variabili d'ambiente)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('Unauthorized cron invocation attempted');
      return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = startOfDay(tomorrow).toISOString();
  const tomorrowEnd = endOfDay(tomorrow).toISOString();

  // Find all appointments for tomorrow
  const { data: appointments, error } = await supabase
    .from('appuntamenti')
    .select('id, send_email, stato')
    .eq('send_email', true)
    .neq('stato', 'annullato')
    .gte('inizio', tomorrowStart)
    .lte('inizio', tomorrowEnd);

  if (error) {
    console.error('Error fetching today appointments for cron:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const results = [];
  for (const apt of appointments || []) {
    try {
      // Chiama l'azione già esistente per inviare il promemoria
      const res = await sendReminderEmailAction(apt.id);
      results.push({ id: apt.id, success: res.success });
    } catch (err: any) {
       console.error(`Error sending reminder for ${apt.id}:`, err);
       results.push({ id: apt.id, success: false, error: err.message });
    }
  }

  console.log(`Cron /api/cron/reminders processed ${results.length} emails.`, results);

  return NextResponse.json({ success: true, processed: results.length, results });
}
