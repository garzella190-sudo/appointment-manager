/**
 * Logica PURA (senza database) che decide chi deve ricevere la notifica push
 * di una modifica del calendario. Sta in un file a parte per poterla verificare
 * facilmente: vedi `scripts/verifica_destinatari_push.js`.
 *
 * Regole richieste dall'autoscuola:
 * - la notifica va **solo al proprietario del calendario toccato**;
 * - **l'autore della modifica non riceve nulla**;
 * - se la modifica riguarda soltanto il calendario dell'autore, **non riceve
 *   nulla nessuno** (prenotare su se stessi è silenzioso);
 * - un altro utente che prenota o modifica il mio calendario → notifica a me;
 * - chi non ha un calendario proprio (segreteria/admin "da scrivania") non viene
 *   avvisato delle modifiche altrui: non è il suo calendario.
 *
 * Unico caso "a tutti": quando il chiamante non sa indicare nessun calendario
 * (lista istruttori vuota) → si avvisano tutti gli iscritti tranne l'autore.
 */

export interface UtenteAuth {
  id: string;
  email?: string | null;
  user_metadata?: {
    istruttore_id?: string | null;
    full_name?: string;
    nome?: string;
    name?: string;
    [chiave: string]: unknown;
  };
}

export interface ProfiloIstruttore {
  id: string;
  nome: string | null;
  cognome: string | null;
  email?: string | null;
}

/** Minuscole e senza accenti: serve per confrontare i nomi degli istruttori. */
export function normalizza(valore: string | null | undefined): string {
  return (valore || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Testo identificativo di un account (nome, cognome, email) normalizzato */
export function testoUtente(utente?: UtenteAuth | null): string {
  return normalizza(
    [
      utente?.user_metadata?.full_name,
      utente?.user_metadata?.nome,
      utente?.user_metadata?.name,
      utente?.email,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

/**
 * L'account corrisponde al profilo istruttore?
 * `stretto` = devono combaciare sia il nome sia il cognome (usato per capire se
 * l'autore della modifica è il proprietario del calendario); altrimenti basta uno dei due.
 */
export function corrispondeAlProfilo(
  profilo: ProfiloIstruttore,
  testo: string,
  stretto: boolean
): boolean {
  const nome = normalizza(profilo.nome);
  const cognome = normalizza(profilo.cognome);
  const okNome = nome.length > 1 && testo.includes(nome);
  const okCognome = cognome.length > 1 && testo.includes(cognome);
  return stretto ? okNome && okCognome : okNome || okCognome;
}

/** L'email dell'account è quella dell'istruttore (collegamento preciso). */
export function corrispondePerEmail(
  profilo: ProfiloIstruttore,
  emailAccount: string | null | undefined
): boolean {
  const email = normalizza(emailAccount);
  return Boolean(email) && normalizza(profilo.email) === email;
}

/** Id della sessione utente (`user_metadata.istruttore_id`), se presente. */
export function istruttoreDellUtente(utente?: UtenteAuth | null): string | null {
  return (utente?.user_metadata?.istruttore_id as string | undefined) || null;
}

export function risolviDestinatariPush(params: {
  utenti: UtenteAuth[];
  /** Profili (da tabella `istruttori`) dei calendari toccati */
  profiliCoinvolti: ProfiloIstruttore[];
  /** Id degli istruttori il cui calendario è stato toccato */
  istruttoriCoinvolti: string[];
  /** Utente che ha fatto la modifica */
  attoreUserId: string | null;
}): Set<string> {
  const { utenti, profiliCoinvolti, istruttoriCoinvolti, attoreUserId } = params;
  const destinatari = new Set<string>();
  const visti = new Set<string>();

  const attore = attoreUserId ? utenti.find((utente) => utente.id === attoreUserId) : undefined;
  const attoreIstruttoreId = istruttoreDellUtente(attore);

  // Calendario non identificato: si avvisano tutti tranne l'autore.
  if (istruttoriCoinvolti.length === 0) {
    for (const utente of utenti) {
      if (utente.id !== attoreUserId) destinatari.add(utente.id);
    }
    return destinatari;
  }

  // Tutti i calendari toccati sono dell'autore? Nessuna notifica a nessuno.
  // Vale per l'account collegato all'istruttore (`istruttore_id`), per un account
  // riconosciuto dall'EMAIL dell'istruttore (es. AdminDev manueleautoscuola@gmail.com,
  // che l'istruttore Manuele Garzella ce l'ha come `istruttori.email`) e per il
  // riconoscimento dal nome completo (utenti creati senza `istruttore_id`).
  const emailAttore = attore?.email ?? null;
  const attorePossiedeTuttiICalendari =
    (attoreIstruttoreId != null &&
      istruttoriCoinvolti.every((id) => id === attoreIstruttoreId)) ||
    (profiliCoinvolti.length > 0 &&
      profiliCoinvolti.length === istruttoriCoinvolti.length &&
      profiliCoinvolti.every(
        (profilo) =>
          corrispondePerEmail(profilo, emailAttore) ||
          corrispondeAlProfilo(profilo, testoUtente(attore), true)
      ));

  if (attorePossiedeTuttiICalendari) return destinatari;

  for (const utente of utenti) {
    if (visti.has(utente.id)) continue;
    visti.add(utente.id);

    // L'autore della modifica non viene mai avvisato
    if (utente.id === attoreUserId) continue;

    const collegato = istruttoreDellUtente(utente);
    if (collegato) {
      if (istruttoriCoinvolti.includes(collegato)) destinatari.add(utente.id);
      continue;
    }

    // Fallback per gli account senza `istruttore_id`: si riconosce l'istruttore
    // dall'email (preciso) oppure dal nome.
    const testo = testoUtente(utente);
    if (
      profiliCoinvolti.some(
        (profilo) =>
          corrispondePerEmail(profilo, utente.email) ||
          corrispondeAlProfilo(profilo, testo, false)
      )
    ) {
      destinatari.add(utente.id);
    }
  }

  return destinatari;
}
