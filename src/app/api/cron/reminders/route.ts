import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendReminderEmailAction, sendReminderImpegnoEmailAction } from '@/actions/notifications';
import { notificaCambioCalendario } from '@/lib/pushHelper';
import { startOfDay, endOfDay, format } from 'date-fns';
import { it } from 'date-fns/locale';

/**
 * Cron dei promemoria. Due lavori, entrambi IDEMPOTENTI (colonne `promemoria_*_inviato_il`):
 *
 * 1) PROMEMORIA AL CLIENTE per le guide di domani (`sendReminderEmailAction`):
 *    salta gli appuntamenti già avvisati, così il cliente riceve UNA sola mail
 *    per appuntamento anche se il cron (o l'endpoint) viene chiamato più volte.
 *
 * 2) PROMEMORIA AL PROPRIETARIO DEL CALENDARIO per gli "altri impegni" con preavviso
 *    (`promemoria_minuti`: 120/240/720/1440): push + email all'istruttore del
 *    calendario, poi marca l'invio.
 *
 * NB: il punto 2 per essere puntuale richiede che questo endpoint venga chiamato
 * spesso (consigliato ogni 15 minuti). Il cron di Vercel su piano Hobby gira una
 * volta al giorno: vedi le istruzioni nel file di migrazione per schedularlo da
 * Supabase (pg_cron) o con un servizio esterno.
 */
export const dynamic = 'force-dynamic';

/** Preavvisi ammessi per il promemoria al proprietario (minuti) */
const PREAVVISI_AMMESSI = [120, 240, 720, 1440];

type RigaPromemoria = {
  id: string;
  inizio: string | null;
  data: string;
  istruttore_id: string | null;
  promemoria_minuti?: number | null;
  promemoria_email_inviato_il?: string | null;
  clienti?: { nome?: string | null; cognome?: string | null } | { nome?: string | null; cognome?: string | null }[] | null;
  istruttori?: { nome?: string | null; cognome?: string | null; email?: string | null } | { nome?: string | null; cognome?: string | null; email?: string | null }[] | null;
};

export async function GET(request: Request) {
  // Vercel inietta questo header quando fa scattare il cron (se CRON_SECRET è configurato).
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('Unauthorized cron invocation attempted');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();

  // ── 1) Promemoria al CLIENTE per le guide di domani ───────────────────────
  const domani = new Date();
  domani.setDate(domani.getDate() + 1);
  const domaniInizio = startOfDay(domani).toISOString();
  const domaniFine = endOfDay(domani).toISOString();

  const cerca = (conMarcatore: boolean) => {
    const colonne = conMarcatore ? 'id, send_email, stato, promemoria_email_inviato_il' : 'id, send_email, stato';
    return supabase
      .from('appuntamenti')
      .select(colonne)
      .eq('send_email', true)
      .neq('stato', 'annullato')
      .gte('inizio', domaniInizio)
      .lte('inizio', domaniFine);
  };

  let { data: appointments, error } = await cerca(true);

  if (error && /promemoria_email_inviato_il/.test(error.message)) {
    console.warn('Colonna promemoria_email_inviato_il assente: esegui la migrazione 20261110140000_promemoria.sql');
    ({ data: appointments, error } = await cerca(false));
  } else if (error) {
    console.error('Error fetching appointments for cron:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const risultatiClienti: { id: string; inviato: boolean; saltato: boolean; errore?: string }[] = [];

  for (const apt of appointments || []) {
    const riga = apt as unknown as RigaPromemoria;
    if (riga.promemoria_email_inviato_il) {
      risultatiClienti.push({ id: riga.id, inviato: false, saltato: true });
      continue;
    }
    try {
      const res = await sendReminderEmailAction(riga.id);
      risultatiClienti.push({
        id: riga.id,
        inviato: Boolean(res.success),
        saltato: Boolean((res as { saltato?: boolean }).saltato),
        errore: (res as { error?: string }).error,
      });
    } catch (err: unknown) {
      const messaggio = err instanceof Error ? err.message : 'errore sconosciuto';
      console.error(`Error sending reminder for ${riga.id}:`, err);
      risultatiClienti.push({ id: riga.id, inviato: false, saltato: false, errore: messaggio });
    }
  }

  // ── 2) Promemoria al PROPRIETARIO per gli "altri impegni" ────────────────
  const { esiti: risultatiImpegni, inAttesa } = await inviaPromemoriaImpegni(supabase);

  console.log(
    `Cron promemoria: ${risultatiClienti.filter(r => r.inviato).length} email ai clienti, ` +
    `${risultatiClienti.filter(r => r.saltato).length} già inviate in passato, ` +
    `${risultatiImpegni.filter(r => r.inviato).length} promemoria impegni`
  );

  return NextResponse.json({
    success: true,
    clienti: {
      valutati: risultatiClienti.length,
      inviati: risultatiClienti.filter(r => r.inviato).length,
      saltati: risultatiClienti.filter(r => r.saltato).length,
      dettaglio: risultatiClienti,
    },
    impegni: {
      valutati: risultatiImpegni.length,
      inviati: risultatiImpegni.filter(r => r.inviato).length,
      /** Impegni con promemoria impostato ma non ancora scattato (con l'ora prevista) */
      inAttesa,
      dettaglio: risultatiImpegni,
    },
  });
}

/**
 * Impegni il cui preavviso è scattato e non ancora avvisati: push + email al
 * proprietario del calendario, poi `promemoria_inviato_il = now()`.
 * Restituisce anche quelli IN ATTESA con l'ora in cui partirà l'avviso: chiamando
 * l'endpoint a mano si vede subito se e quando il promemoria è programmato.
 */
async function inviaPromemoriaImpegni(
  supabase: ReturnType<typeof createAdminClient>
): Promise<{
  esiti: { id: string; inviato: boolean; saltato?: boolean; errore?: string }[];
  inAttesa: { id: string; avvisoAlle: string; preavvisoMinuti: number }[];
}> {
  const esiti: { id: string; inviato: boolean; saltato?: boolean; errore?: string }[] = [];
  const inAttesa: { id: string; avvisoAlle: string; preavvisoMinuti: number }[] = [];

  const { data: candidati, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, inizio, data, durata, istruttore_id, promemoria_minuti, promemoria_inviato_il,
      clienti ( nome, cognome ),
      istruttori ( nome, cognome, email )
    `)
    .not('promemoria_minuti', 'is', null)
    .is('promemoria_inviato_il', null)
    .neq('stato', 'annullato');

  if (error) {
    if (/promemoria_minuti|promemoria_inviato_il/.test(error.message)) {
      console.warn('Colonne promemoria impegni assenti: promemoria al proprietario disattivati fino alla migrazione');
      return { esiti, inAttesa };
    }
    console.error('Errore lettura impegni con promemoria:', error.message);
    return { esiti, inAttesa };
  }

  const adesso = Date.now();

  for (const rigaGrezza of candidati || []) {
    const riga = rigaGrezza as unknown as RigaPromemoria;
    const preavviso = Number(riga.promemoria_minuti);
    if (!PREAVVISI_AMMESSI.includes(preavviso)) continue;

    const inizio = new Date(riga.inizio || riga.data).getTime();
    if (Number.isNaN(inizio)) continue;

    const quandoAvvisare = inizio - preavviso * 60000;
    if (adesso < quandoAvvisare) {
      // troppo presto: si riporta quando partirà (diagnostica)
      inAttesa.push({ id: riga.id, avvisoAlle: new Date(quandoAvvisare).toISOString(), preavvisoMinuti: preavviso });
      continue;
    }
    if (adesso > inizio) continue;         // impegno già iniziato/finito

    const istruttore = Array.isArray(riga.istruttori) ? riga.istruttori[0] : riga.istruttori;
    const ufficio = Array.isArray(riga.clienti) ? riga.clienti[0] : riga.clienti;
    const nomeImpegno = ufficio?.cognome || 'Impegno';
    const giorno = format(new Date(riga.inizio || riga.data), "EEE d MMM 'alle' HH:mm", { locale: it });

    // ── PRENOTAZIONE ATOMICA (push + email insieme) ─────────────────────────
    // Si scrive il marcatore *prima* di avvisare, con un UPDATE condizionato:
    // se due giri di cron si sovrappongono, solo uno trova la riga ancora da
    // marcare. Senza questo, la push e la mail partivano due volte.
    const marcatoAlle = new Date().toISOString();
    const { data: prenotato, error: errorePrenotazione } = await supabase
      .from('appuntamenti')
      .update({ promemoria_inviato_il: marcatoAlle })
      .eq('id', riga.id)
      .is('promemoria_inviato_il', null)
      .select('id');

    if (errorePrenotazione) {
      if (/promemoria_inviato_il/.test(errorePrenotazione.message)) {
        // Colonna assente: si prosegue senza marcatore (come prima della migrazione)
        console.warn('Colonna promemoria_inviato_il assente: promemoria senza marcatore');
      } else {
        esiti.push({ id: riga.id, inviato: false, errore: errorePrenotazione.message });
        continue;
      }
    } else if (!prenotato || prenotato.length === 0) {
      // Un altro giro l'ha già preso in carico
      esiti.push({ id: riga.id, inviato: false, saltato: true });
      continue;
    }

    /** L'invio è fallito: si libera il marcatore così un giro successivo riprova. */
    const rilascia = async () => {
      const { error } = await supabase
        .from('appuntamenti')
        .update({ promemoria_inviato_il: null })
        .eq('id', riga.id)
        .eq('promemoria_inviato_il', marcatoAlle);
      if (error) console.error('Impossibile liberare il promemoria impegno:', error.message);
    };

    try {
      // PUSH al proprietario del calendario
      if (riga.istruttore_id) {
        await notificaCambioCalendario({
          istruttoriCoinvolti: [riga.istruttore_id],
          payload: {
            title: '⏰ Promemoria impegno',
            body: `${nomeImpegno} — ${giorno}`,
            url: '/calendar',
          },
        });
      }

      // EMAIL al proprietario (istruttori.email)
      if (istruttore?.email) {
        const esito = await sendReminderImpegnoEmailAction(riga.id);
        if (!esito.success) {
          await rilascia();
          esiti.push({ id: riga.id, inviato: false, errore: esito.error });
          continue;
        }
      }

      // Il marcatore è già scritto: l'impegno non riceverà altri avvisi
      esiti.push({ id: riga.id, inviato: true });
    } catch (err: unknown) {
      const messaggio = err instanceof Error ? err.message : 'errore sconosciuto';
      console.error(`Errore promemoria impegno ${riga.id}:`, err);
      await rilascia();
      esiti.push({ id: riga.id, inviato: false, errore: messaggio });
    }
  }

  return { esiti, inAttesa };
}
