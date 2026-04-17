const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get ALL appointments for today March 24, including deleted/canceled
  const { data } = await supabase
    .from('appuntamenti')
    .select('id, inizio, fine, stato, eliminato_il, clienti(cognome, nome), istruttori(cognome), veicoli(nome)')
    .gte('inizio', '2026-03-24T00:00:00')
    .lte('inizio', '2026-03-24T23:59:59')
    .order('inizio');

  process.stdout.write('=== TUTTI GLI APPUNTAMENTI DI OGGI (24/03) ===\n');
  for (const a of (data || [])) {
    const deleted = a.eliminato_il ? '🗑 ELIMINATO (' + a.eliminato_il.slice(0,10) + ')' : '✅ ATTIVO';
    process.stdout.write(
      '[' + a.id.slice(0,8) + '] ' +
      (a.inizio||'').slice(11,16) + ' UTC -> ' + (a.fine||'').slice(11,16) + ' UTC | ' +
      deleted + ' | stato: ' + a.stato +
      ' | cliente: ' + (a.clienti?.cognome||'?') +
      ' | istr: ' + (a.istruttori?.cognome||'?') +
      ' | veicolo: ' + (a.veicoli?.nome||'?') + '\n'
    );
  }
}

check();
