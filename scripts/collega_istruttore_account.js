/**
 * Collega un ACCOUNT (auth user) al suo ISTRUTTORE, scrivendo `istruttore_id`
 * nei user_metadata. Serve per gli account creati a mano, tipo l'AdminDev
 * "Manueleautoscuola@gmail.com", che devono valere anche come istruttori
 * (calendario proprio, colonna in agenda, preassegnazione delle guide).
 *
 * L'app riconosce già il collegamento anche senza questo passaggio (guarda
 * `istruttori.email` e nome/cognome: vedi `src/lib/istruttoreCorrente.ts`), ma qui
 * il legame diventa ESPLICITO nel database.
 *
 * Uso:
 *   node scripts/collega_istruttore_account.js <email-account> [email-istruttore] [ruolo]
 *   node scripts/collega_istruttore_account.js manueleautoscuola@gmail.com
 *   node scripts/collega_istruttore_account.js manueleautoscuola@gmail.com manueleautoscuola@gmail.com AdminDev
 *
 * Richiede in ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 * Non cancella gli altri metadata: aggiunge/aggiorna `istruttore_id` (e `role` se indicato).
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

/**
 * Carica `.env.local` (o `.env`) se le variabili non sono già nell'ambiente.
 * Node non legge i file .env da solo: così lo script funziona anche senza
 * esportare a mano le chiavi nel terminale.
 */
(function caricaEnvLocale() {
  for (const nome of ['.env.local', '.env']) {
    const percorso = path.join(process.cwd(), nome);
    if (!fs.existsSync(percorso)) continue;

    for (const riga of fs.readFileSync(percorso, 'utf8').split(/\r?\n/)) {
      const trovata = riga.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!trovata) continue;
      const [, chiave, valoreGrezzo] = trovata;
      if (process.env[chiave]) continue;
      process.env[chiave] = valoreGrezzo.replace(/^['"]|['"]$/g, '').trim();
    }
  }
})();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Mancano NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Aggiungile in .env.local oppure passale nel terminale, es.:');
  console.error('  $env:NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"');
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
  process.exit(1);
}

const [emailAccount, emailIstruttore, ruolo] = process.argv.slice(2);
if (!emailAccount) {
  console.error('Uso: node scripts/collega_istruttore_account.js <email-account> [email-istruttore] [ruolo]');
  process.exit(1);
}

const RUOLI_VALIDI = ['AdminDev', 'admin', 'istruttore', 'segreteria'];
if (ruolo && !RUOLI_VALIDI.includes(ruolo)) {
  console.error(`Ruolo non valido: ${ruolo}. Valori ammessi: ${RUOLI_VALIDI.join(', ')}`);
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const normalizza = (v) => String(v || '').trim().toLowerCase();

async function trovaUtente(email) {
  const PER_PAGINA = 200;
  for (let pagina = 1; pagina <= 25; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: PER_PAGINA });
    if (error) throw new Error('Errore listUsers: ' + error.message);
    if (!data?.users?.length) break;

    const trovato = data.users.find((u) => normalizza(u.email) === normalizza(email));
    if (trovato) return trovato;
    if (data.users.length < PER_PAGINA) break;
  }
  return null;
}

(async () => {
  const utente = await trovaUtente(emailAccount);
  if (!utente) {
    console.error(`Account non trovato: ${emailAccount}`);
    process.exit(1);
  }

  const emailIstr = emailIstruttore || emailAccount;
  const { data: istruttore, error: erroreIstruttore } = await admin
    .from('istruttori')
    .select('id, nome, cognome, email')
    .ilike('email', emailIstr)
    .maybeSingle();

  if (erroreIstruttore) {
    console.error('Errore lettura istruttori:', erroreIstruttore.message);
    process.exit(1);
  }
  if (!istruttore) {
    console.error(`Nessun istruttore con email ${emailIstr}: aggiungila in Gestione → Istruttori.`);
    process.exit(1);
  }

  const giaCollegato = utente.user_metadata?.istruttore_id === istruttore.id;
  const ruoloGiaOk = !ruolo || utente.user_metadata?.role === ruolo;

  if (giaCollegato && ruoloGiaOk) {
    console.log(`✓ Già a posto: ${utente.email} → ${istruttore.nome} ${istruttore.cognome}` +
      (ruolo ? ` (ruolo ${ruolo})` : ''));
    return;
  }

  const { error } = await admin.auth.admin.updateUserById(utente.id, {
    user_metadata: {
      ...(utente.user_metadata || {}),
      istruttore_id: istruttore.id,
      ...(ruolo ? { role: ruolo } : {}),
    },
  });

  if (error) {
    console.error('Errore aggiornamento account:', error.message);
    process.exit(1);
  }

  console.log(`✓ Collegato: ${utente.email} → ${istruttore.nome} ${istruttore.cognome} (${istruttore.id})` +
    (ruolo ? `, ruolo ${ruolo}` : ''));
})().catch((errore) => {
  console.error('Errore imprevisto:', errore.message);
  process.exit(1);
});
