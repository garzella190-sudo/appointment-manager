const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const targetDate = '2026-03-23';
  
  // Find instructor ID for Garzella
  const { data: istrs } = await supabase.from('istruttori').select('id, nome, cognome').ilike('cognome', '%Garzella%');
  const garzellaId = istrs?.[0]?.id;

  // Find vehicle ID for Fiat Panda
  const { data: veicolo } = await supabase.from('veicoli').select('id, nome').ilike('nome', '%Panda%');
  const pandaId = veicolo?.[0]?.id;

  const { data: apts, error: aptError } = await supabase
    .from('appuntamenti')
    .select('*, clienti(cognome, nome), istruttori(cognome, nome), veicoli(nome)')
    .or(`istruttore_id.eq.${garzellaId},veicolo_id.eq.${pandaId}`)
    .eq('data_solo', targetDate);

  if (aptError) {
    fs.writeFileSync('debug_results.json', JSON.stringify({ error: aptError }));
  } else {
    fs.writeFileSync('debug_results.json', JSON.stringify(apts, null, 2));
  }
}

run();
