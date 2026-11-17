import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * DIAGNOSTICA DEI PROMEMORIA (sola lettura + una prova innocua).
 *
 * Serve a capire perché una mail di promemoria non arriva, senza dover leggere i
 * log di Vercel:
 *
 *   /api/diagnostica/promemoria              → stato generale + prova di programmazione
 *   /api/diagnostica/promemoria?azione=stato → solo la fotografia del database
 *
 * La prova programma una mail di test verso l'indirizzo dell'autoscuola per 2 minuti
 * nel futuro e la annulla subito dopo: non scrive a nessun cliente.
 *
 * NOTA: dare una occhiata anche a Resend → Emails (filtro "Scheduled"): se le mail
 * programmate non ci sono proprio, l'errore è nella chiamata; se ci sono ed è
 * comparso un "failed", il motivo è scritto lì.
 */
export const dynamic = 'force-dynamic';

const SENDER = 'Autoscuola Toscana <notifiche@guide.autoscuolatoscanasnc.it>';
const INDIRIZZO_PROVA = 'manueleautoscuola@gmail.com';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const soloStato = url.searchParams.get('azione') === 'stato';

  const supabase = createAdminClient();
  const resendApiKey = process.env.RESEND_API_KEY;

  const adesso = new Date();
  const fra24h = new Date(adesso.getTime() + 24 * 60 * 60 * 1000);
  const oggi = adesso.toISOString().slice(0, 10);

  // 1) Le colonne della programmazione esistono?
  const colonne: Record<string, boolean> = {};
  for (const nome of ['promemoria_email_inviato_il', 'promemoria_email_id', 'promemoria_email_per']) {
    const { error } = await supabase.from('appuntamenti').select(`id, ${nome}`).limit(1);
    colonne[nome] = !error;
  }

  // 2) Le prossime guide con l'email attiva
  const { data: prossime, error: erroreLettura } = await supabase
    .from('appuntamenti')
    .select('id, inizio, send_email, stato, created_at, clienti ( nome, cognome, email )')
    .eq('send_email', true)
    .neq('stato', 'annullato')
    .gte('data_solo', oggi)
    .order('inizio', { ascending: true })
    .limit(10);

  const righe = (prossime || []) as unknown as {
    id: string;
    inizio: string | null;
    created_at?: string | null;
    clienti?: { nome?: string | null; cognome?: string | null; email?: string | null } | { nome?: string | null; cognome?: string | null; email?: string | null }[] | null;
  }[];

  const elenco = righe.map((riga) => {
    const cliente = Array.isArray(riga.clienti) ? riga.clienti[0] : riga.clienti;
    const inizio = new Date(riga.inizio || '').getTime();
    // Nessun dato personale: solo stato tecnico. L'endpoint è raggiungibile senza login.
    return {
      id: riga.id,
      inizio: riga.inizio,
      creatoIl: riga.created_at || null,
      haEmailCliente: Boolean(cliente?.email),
      /** il promemoria doveva partire 24h prima: è già passato? */
      promemoriaDovevaPartireIl: Number.isNaN(inizio) ? null : new Date(inizio - 24 * 60 * 60 * 1000).toISOString(),
      entro24h: !Number.isNaN(inizio) && inizio <= fra24h.getTime()
    };
  });

  const risposta: Record<string, unknown> = {
    adesso: adesso.toISOString(),
    oraItaliana: Number(
      new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(adesso)
    ),
    chiaveResendPresente: Boolean(resendApiKey),
    colonne,
    guideConEmailAttiva: elenco.length,
    erroreLettura: erroreLettura?.message || null,
    guide: elenco,
  };

  // 3) Prova di programmazione (innocua: verso l'autoscuola, annullata subito)
  if (!soloStato) {
    if (!resendApiKey) {
      risposta.prova = { esito: 'saltata', motivo: 'RESEND_API_KEY assente' };
    } else {
      const resend = new Resend(resendApiKey);
      const quando = new Date(Date.now() + 2 * 60 * 1000).toISOString();

      // Prova IDENTICA alla mail vera: stesso mittente, stesso tipo di allegato .ics
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Autoscuola Toscana//IT',
        'BEGIN:VEVENT',
        'DTSTART:20261120T090000Z',
        'DTEND:20261120T100000Z',
        'SUMMARY:Prova',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const { data, error } = await resend.emails.send({
        from: SENDER,
        to: INDIRIZZO_PROVA,
        subject: 'Prova programmazione promemoria (ignorare)',
        html: '<p>Messaggio di prova della diagnostica. Se lo ricevi, la programmazione non è stata annullata: ignoralo.</p>',
        attachments: [
          { filename: 'prova.ics', content: Buffer.from(ics).toString('base64'), contentType: 'text/calendar' }
        ],
        scheduledAt: quando
      });

      if (error) {
        risposta.prova = {
          esito: 'ERRORE su scheduledAt',
          quando,
          errore: error,
          // Traduzione dei casi più comuni
          spiegazione:
            'Se qui compare un errore, Resend non accetta la programmazione per questo account/piano: in quel caso i promemoria vanno mandati dal cron (va cambiato approccio).'
        };
      } else {
        let annullamento = 'non tentato';
        if (data?.id) {
          try {
            const cancellata = await resend.emails.cancel(data.id);
            annullamento = cancellata.error ? `errore: ${JSON.stringify(cancellata.error)}` : 'ok';
          } catch (e) {
            annullamento = `eccezione: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
        risposta.prova = { esito: 'OK: programmazione accettata', quando, id: data?.id, annullamento };
      }
    }
  }

  return NextResponse.json(risposta, { headers: { 'Cache-Control': 'no-store' } });
}
