import webpush from 'web-push';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient as createServerClient } from '@/utils/supabase/server';
import {
  risolviDestinatariPush,
  type ProfiloIstruttore,
  type UtenteAuth,
} from '@/lib/pushDestinatari';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const VAPID_MAIL = 'mailto:support@autoscuolatoscana.it';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(VAPID_MAIL, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('VAPID keys not configured. Web Push notifications are disabled.');
}

export interface NotificaPush {
  title: string;
  body: string;
  url?: string;
}

interface Iscrizione {
  id: string;
  user_id: string | null;
  subscription: webpush.PushSubscription;
}

function pushAttive(): boolean {
  return Boolean(vapidPublicKey && vapidPrivateKey);
}

/**
 * Id dell'utente che ha fatto la modifica (sessione della richiesta in corso).
 * Serve a NON mandargli la notifica: usato come default quando il chiamante
 * non passa `attoreUserId`.
 */
async function utenteCorrenteId(): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Elenco COMPLETO degli utenti.
 *
 * `auth.admin.listUsers()` restituisce al massimo una pagina (50 utenti di default):
 * senza paginazione gli account creati per ultimi non venivano mai trovati e le loro
 * notifiche non partivano mai. Da qui il ciclo a pagine.
 */
async function elencoUtenti(): Promise<UtenteAuth[]> {
  const admin = createAdminClient();
  const utenti: UtenteAuth[] = [];
  const PER_PAGINA = 200;

  for (let pagina = 1; pagina <= 25; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: PER_PAGINA });
    if (error || !data?.users?.length) break;
    utenti.push(...(data.users as unknown as UtenteAuth[]));
    if (data.users.length < PER_PAGINA) break;
  }

  return utenti;
}

/** Profili (nome/cognome/email) degli istruttori coinvolti: servono al riconoscimento per nome/email. */
async function profiliIstruttori(istruttoriCoinvolti: string[]): Promise<ProfiloIstruttore[]> {
  if (istruttoriCoinvolti.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from('istruttori')
    .select('id, nome, cognome, email')
    .in('id', istruttoriCoinvolti);
  return (data || []) as ProfiloIstruttore[];
}

/** Invia il payload a ogni dispositivo, saltando i duplicati e ripulendo le iscrizioni morte. */
async function inviaAIDispositivi(iscrizioni: Iscrizione[], payload: NotificaPush): Promise<number> {
  const admin = createAdminClient();
  const endpointVisti = new Set<string>();
  let inviati = 0;

  await Promise.all(
    iscrizioni.map(async (riga) => {
      const endpoint = riga.subscription?.endpoint;
      if (!endpoint || endpointVisti.has(endpoint)) return;
      endpointVisti.add(endpoint);

      try {
        await webpush.sendNotification(riga.subscription, JSON.stringify(payload), { TTL: 60 * 60 });
        inviati++;
      } catch (error) {
        const stato = (error as { statusCode?: number })?.statusCode;
        if (stato === 404 || stato === 410) {
          await admin.from('push_subscriptions').delete().eq('id', riga.id);
        } else {
          console.error('Errore invio notifica push:', stato || (error as Error)?.message || error);
        }
      }
    })
  );

  return inviati;
}

/**
 * Notifica PUSH di una modifica del calendario (inserimento, modifica, spostamento,
 * annullamento, eliminazione di guide o di altri impegni).
 *
 * `istruttoriCoinvolti` = i calendari toccati (per uno spostamento: nuovo e vecchio
 * istruttore). Riceve la notifica **solo il proprietario di quei calendari**, mai
 * chi ha fatto la modifica: se Manuele prenota su se stesso non arriva niente a
 * nessuno, se la segreteria prenota su Francesco la notifica arriva a Francesco.
 *
 * Se `attoreUserId` non viene passato, l'autore viene ricavato dalla sessione
 * (cookie) della richiesta in corso.
 */
export async function notificaCambioCalendario(params: {
  payload: NotificaPush;
  istruttoriCoinvolti?: (string | null | undefined)[];
  attoreUserId?: string | null;
}): Promise<{ destinatari: number; dispositivi: number }> {
  const esito = { destinatari: 0, dispositivi: 0 };
  if (!pushAttive()) return esito;

  const admin = createAdminClient();
  const istruttoriCoinvolti = [
    ...new Set((params.istruttoriCoinvolti || []).filter((id): id is string => Boolean(id))),
  ];

  try {
    const attoreUserId = params.attoreUserId !== undefined
      ? params.attoreUserId
      : await utenteCorrenteId();

    const { data: iscrizioni, error } = await admin
      .from('push_subscriptions')
      .select('id, user_id, subscription');

    if (error) {
      console.error('Errore lettura push_subscriptions:', error.message);
      return esito;
    }
    if (!iscrizioni || iscrizioni.length === 0) return esito;

    const [utenti, profiliCoinvolti] = await Promise.all([
      elencoUtenti(),
      profiliIstruttori(istruttoriCoinvolti),
    ]);

    const destinatari = risolviDestinatariPush({
      utenti,
      profiliCoinvolti,
      istruttoriCoinvolti,
      attoreUserId,
    });

    // Nessun destinatario = nessuna notifica (es. modifica sul proprio calendario).
    if (destinatari.size === 0) return esito;

    const daAvvisare = (iscrizioni as Iscrizione[]).filter(
      (riga) => riga.user_id && destinatari.has(riga.user_id)
    );

    if (daAvvisare.length === 0) return { destinatari: destinatari.size, dispositivi: 0 };

    const dispositivi = await inviaAIDispositivi(daAvvisare, params.payload);

    return { destinatari: destinatari.size, dispositivi };
  } catch (errore) {
    console.error('Errore notifica cambio calendario:', errore);
    return esito;
  }
}

/**
 * Notifica il proprietario di un calendario quando si conosce già l'istruttore
 * toccato. Stessa logica di `notificaCambioCalendario`: se l'autore è il
 * proprietario non parte nulla.
 */
export async function sendNotificationToInstructor(
  instructorId: string,
  payload: NotificaPush,
  attoreUserId?: string | null
): Promise<void> {
  if (!instructorId) return;
  await notificaCambioCalendario({ payload, istruttoriCoinvolti: [instructorId], attoreUserId });
}
