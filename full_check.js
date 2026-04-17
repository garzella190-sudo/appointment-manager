const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const day = '2026-03-24';
  
  console.log(`=== ANALISI APPROFONDITA PER IL GIORNO ${day} ===`);

  // 1. Appuntamenti
  const { data: apts } = await supabase
    .from('appuntamenti')
    .select('id, inizio, fine, stato, eliminato_il, cliente_id, istruttore_id, veicolo_id, clienti(cognome), istruttori(cognome), veicoli(nome)')
    .gte('inizio', `${day}T00:00:00Z`)
    .lte('inizio', `${day}T23:59:59Z`)
    .order('inizio');

  console.log('\n--- TABELLA: appuntamenti ---');
  for (const a of (apts || [])) {
    const status = a.eliminato_il ? '🗑 ELIMINATO' : (a.stato === 'annullato' ? '❌ ANNULLATO' : '✅ ATTIVO');
    console.log(`[${a.id.slice(0,8)}] ${a.inizio.slice(11,16)} - ${a.fine.slice(11,16)} | ${status} | Istr: ${a.istruttori?.cognome} | Veh: ${a.veicoli?.nome} | Cli: ${a.clienti?.cognome}`);
  }

  // 2. Impegni
  const { data: impegni } = await supabase
    .from('impegni')
    .select('id, data, ora_inizio, durata, eliminato_il, istruttore_id, istruttori(cognome)')
    .eq('data', day);

  console.log('\n--- TABELLA: impegni ---');
  for (const i of (impegni || [])) {
    const status = i.eliminato_il ? '🗑 ELIMINATO' : '✅ ATTIVO';
    console.log(`[${i.id.slice(0,8)}] ${i.ora_inizio.slice(0,5)} (${i.durata}m) | ${status} | Istr: ${i.istruttori?.cognome} | Tipo: ${i.tipo}`);
  }
}

check();
