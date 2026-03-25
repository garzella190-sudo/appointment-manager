const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://cpdmlnxquybciajkqkhr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZG1sbnhxdXliY2lhamtxa2hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4OTM3NSwiZXhwIjoyMDg4NjY1Mzc1fQ.WLJ-JlDK6e8_wRksIBRlxi9CNPlh4oGLx4PsklWEzjY'
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
