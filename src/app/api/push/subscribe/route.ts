import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { subscription } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Subscription non valida' }, { status: 400 });
    }

    // Salva nel database (se esiste già una riga con la stessa subscription, la policy o il constraint eviterà i duplicati)
    // Usiamo upsert basato sulla subscription (richiede che la constraint sia unica su `subscription`)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: session.user.id,
        subscription: subscription
      }, { onConflict: 'subscription' });

    if (error) {
      console.error('Error saving subscription:', error);
      return NextResponse.json({ error: 'Errore durante il salvataggio' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Push subscribe error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint non valido' }, { status: 400 });
    }

    // Elimina basandosi sull'endpoint (che è una chiave all'interno del JSONB)
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', session.user.id)
      .contains('subscription', { endpoint });

    if (error) {
      console.error('Error deleting subscription:', error);
      return NextResponse.json({ error: 'Errore durante l\'eliminazione' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Push unsubscribe error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
