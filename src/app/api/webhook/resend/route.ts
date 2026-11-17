import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificaCambioCalendario } from '@/lib/pushHelper';

/**
 * WEBHOOK DI RESEND → serve a mandare la PUSH degli impegni all'istante esatto.
 *
 * Perché così: la mail dell'impegno è programmata su Resend per
 * "inizio − preavviso" e viene consegnata al minuto. Quando Resend la spedisce,
 * chiama questo endpoint (evento `email.sent`): a quel punto mandiamo la push.
 *
 * In questo modo la notifica non dipende più da un cron che deve indovinare il
 * momento: il segnale arriva da chi spedisce davvero la mail. Se il webhook non
 * è configurato, la push continua a essere tentata dal cron giornaliero.
 *
 * Sicurezza: la chiamata è firmata da Resend (Svix). Senza
 * RESEND_WEBHOOK_SECRET l'endpoint rifiuta tutto, così nessuno può far suonare
 * i telefoni a piacere.
 */
export const dynamic = 'force-dynamic';

// NB: richiede RESEND_WEBHOOK_SECRET su Vercel (Environment Variables, Production).
// Senza, l'endpoint risponde 503 e non manda nessuna push.

export async function POST(request: Request) {
  const segreto = process.env.RESEND_WEBHOOK_SECRET;
  const chiave = process.env.RESEND_API_KEY;

  if (!segreto || !chiave) {
    console.error('Webhook Resend non configurato (RESEND_WEBHOOK_SECRET / RESEND_API_KEY)');
    return NextResponse.json(
      { ok: false, errore: 'RESEND_WEBHOOK_SECRET non configurato su Vercel' },
      { status: 503 }
    );
  }

  const corpo = await request.text();

  // Resend firma le chiamate con Svix: questi tre header sono la prova che la
  // richiesta arriva davvero da Resend e non da un passante.
  const intestazioni = {
    id: request.headers.get('svix-id') || '',
    timestamp: request.headers.get('svix-timestamp') || '',
    signature: request.headers.get('svix-signature') || ''
  };

  let evento: { type?: string; data?: { email_id?: string; subject?: string } };
  try {
    evento = new Resend(chiave).webhooks.verify({
      payload: corpo,
      headers: intestazioni,
      webhookSecret: segreto
    }) as unknown as { type?: string; data?: { email_id?: string; subject?: string } };
  } catch (errore) {
    console.warn('Webhook Resend: firma non valida', errore instanceof Error ? errore.message : errore);
    return NextResponse.json({ ok: false, errore: 'firma non valida' }, { status: 401 });
  }

  // Ci interessa il momento in cui la mail parte davvero
  if (evento.type !== 'email.sent' && evento.type !== 'email.delivered') {
    return NextResponse.json({ ok: true, ignorato: evento.type });
  }

  const idEmail = evento.data?.email_id;
  if (!idEmail) return NextResponse.json({ ok: true, ignorato: 'email_id assente' });

  const supabase = createAdminClient();

  // A quale appuntamento appartiene quella mail?
  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, inizio, data, istruttore_id, promemoria_minuti, promemoria_inviato_il,
      clienti ( nome, cognome )
    `)
    .eq('promemoria_email_id', idEmail)
    .maybeSingle();

  if (error) {
    console.error('Webhook Resend: lettura appuntamento fallita', error.message);
    return NextResponse.json({ ok: false, errore: error.message }, { status: 500 });
  }
  if (!apt) return NextResponse.json({ ok: true, ignorato: 'nessun appuntamento collegato' });

  // Solo gli IMPEGNI mandano la push: il promemoria delle guide è per il cliente.
  // Il tipo si riconosce dal cliente fittizio UFFICIO.
  const cliente = Array.isArray(apt.clienti) ? apt.clienti[0] : apt.clienti;
  if (cliente?.nome !== 'UFFICIO') return NextResponse.json({ ok: true, ignorato: 'non è un impegno' });

  // RISPETTO DEL "MAI": se il promemoria dell'impegno è disattivato non si manda
  // nessuna push. L'unica eccezione è la mail di PROVA generata dal pulsante
  // "Prova push fra 3 minuti", riconosciuta dal suo oggetto.
  const oggetto = evento.data?.subject || '';
  const eProva = oggetto.startsWith('PROVA promemoria');
  if (!apt.promemoria_minuti && !eProva) {
    return NextResponse.json({ ok: true, ignorato: 'promemoria disattivato (Mai)' });
  }

  if (apt.promemoria_inviato_il) return NextResponse.json({ ok: true, saltato: 'già avvisato' });

  // Prenotazione atomica: se il cron è arrivato prima, questo giro non fa nulla
  const { data: prenotato } = await supabase
    .from('appuntamenti')
    .update({ promemoria_inviato_il: new Date().toISOString() })
    .eq('id', apt.id)
    .is('promemoria_inviato_il', null)
    .select('id');

  if (!prenotato || prenotato.length === 0) {
    return NextResponse.json({ ok: true, saltato: 'già preso in carico' });
  }

  const nomeImpegno = cliente?.cognome || 'Impegno';
  const giorno = format(new Date(apt.inizio || apt.data), "EEE d MMM 'alle' HH:mm", { locale: it });

  try {
    const esito = await notificaCambioCalendario({
      istruttoriCoinvolti: [apt.istruttore_id],
      payload: {
        title: '⏰ Promemoria impegno',
        body: `${nomeImpegno} — ${giorno}`,
        url: '/calendar'
      }
    });

    // Nessun dispositivo raggiunto: si libera il marcatore così il cron può riprovare
    if (esito.dispositivi === 0) {
      await supabase
        .from('appuntamenti')
        .update({ promemoria_inviato_il: null })
        .eq('id', apt.id);
      return NextResponse.json({ ok: true, push: 0, nota: 'nessun dispositivo iscritto' });
    }

    console.log(`Push impegno inviata a ${esito.dispositivi} dispositivo/i per ${nomeImpegno}`);
    return NextResponse.json({ ok: true, push: esito.dispositivi });
  } catch (errore) {
    console.error('Webhook Resend: errore invio push', errore);
    await supabase.from('appuntamenti').update({ promemoria_inviato_il: null }).eq('id', apt.id);
    return NextResponse.json({ ok: false, errore: 'push non inviata' }, { status: 500 });
  }
}
