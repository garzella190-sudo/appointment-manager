import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Collegamento tra l'ACCOUNT che accede e l'ISTRUTTORE (il suo calendario).
 *
 * Un tempo si guardava solo `user_metadata.istruttore_id`: se quel campo mancava
 * (account creati a mano, come l'AdminDev "Manueleautoscuola@gmail.com") l'utente
 * non risultava istruttore — niente colonna propria in agenda, niente preassegnazione
 * della guida, notifiche di sé a se stesso. Qui il collegamento viene ricostruito:
 *
 *  1. `user_metadata.istruttore_id` → collegamento esplicito (il più affidabile);
 *  2. email dell'account == email dell'istruttore (`istruttori.email`);
 *  3. nome E cognome dell'istruttore presenti in `full_name`/email dell'account.
 *
 * Nota: `normalizza` è duplicata di proposito da `lib/pushDestinatari`, che resta un
 * modulo senza import (viene compilato da solo per i test dei destinatari push).
 */

export interface IstruttoreCollegabile {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
}

function normalizza(valore: string | null | undefined): string {
  return (valore || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Elenco istruttori in cache (cambia raramente: si evita una query per ogni componente) */
let cache: { elenco: IstruttoreCollegabile[]; scadenza: number } | null = null;
/** Richiesta in corso: più componenti che usano `useAuth` condividono la stessa query */
let richiestaInCorso: Promise<IstruttoreCollegabile[]> | null = null;
const DURATA_CACHE_MS = 5 * 60 * 1000;

export async function elencoIstruttoriCollegabili(
  supabase: SupabaseClient,
  forza = false
): Promise<IstruttoreCollegabile[]> {
  if (!forza && cache && cache.scadenza > Date.now()) return cache.elenco;
  if (!forza && richiestaInCorso) return richiestaInCorso;

  richiestaInCorso = (async () => {
    const { data, error } = await supabase.from('istruttori').select('id, nome, cognome, email');

    if (error) {
      console.error('Errore nel caricamento degli istruttori:', error.message);
      return cache?.elenco ?? [];
    }

    const elenco = (data || []) as unknown as IstruttoreCollegabile[];
    cache = { elenco, scadenza: Date.now() + DURATA_CACHE_MS };
    return elenco;
  })().finally(() => {
    richiestaInCorso = null;
  });

  return richiestaInCorso;
}

/** Svuota la cache (dopo aver modificato gli istruttori in Gestione) */
export function invalidaCacheIstruttori(): void {
  cache = null;
  richiestaInCorso = null;
}

/** Id dell'istruttore collegato all'account, oppure null. */
export function risolviIstruttoreCollegato(
  utente: User | null | undefined,
  istruttori: IstruttoreCollegabile[]
): string | null {
  if (!utente) return null;

  const daMetadata = (utente.user_metadata?.istruttore_id as string | undefined) || null;
  if (daMetadata) return daMetadata;

  // 2. Email dell'account = email dell'istruttore (collegamento preciso)
  const email = normalizza(utente.email);
  if (email) {
    const perEmail = istruttori.find(istr => normalizza(istr.email) === email);
    if (perEmail) return perEmail.id;
  }

  // 3. Nome + cognome contenuti nei dati dell'account
  const testo = normalizza(
    [
      utente.user_metadata?.full_name,
      utente.user_metadata?.nome,
      utente.user_metadata?.name,
      utente.email,
    ]
      .filter(Boolean)
      .join(' ')
  );
  if (!testo) return null;

  const riconosciuto = istruttori.find(istr => {
    const nome = normalizza(istr.nome);
    const cognome = normalizza(istr.cognome);
    return nome.length > 1 && cognome.length > 1 && testo.includes(nome) && testo.includes(cognome);
  });

  return riconosciuto?.id ?? null;
}

/** Risoluzione asincrona: legge (con cache) gli istruttori e collega l'account. */
export async function risolviIstruttorePerUtente(
  supabase: SupabaseClient,
  utente: User | null | undefined
): Promise<string | null> {
  if (!utente) return null;
  const daMetadata = (utente.user_metadata?.istruttore_id as string | undefined) || null;
  if (daMetadata) return daMetadata;

  try {
    const istruttori = await elencoIstruttoriCollegabili(supabase);
    return risolviIstruttoreCollegato(utente, istruttori);
  } catch {
    return null;
  }
}
