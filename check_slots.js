const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://cpdmlnxquybciajkqkhr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZG1sbnhxdXliY2lhamtxa2hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4OTM3NSwiZXhwIjoyMDg4NjY1Mzc1fQ.WLJ-JlDK6e8_wRksIBRlxi9CNPlh4oGLx4PsklWEzjY'
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
