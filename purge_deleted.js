const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function purge() {
  console.log('Searching for soft-deleted appointments today...');
  const { data: softDeleted, error: findError } = await supabase
    .from('appuntamenti')
    .select('id, inizio, fine, clienti(cognome)')
    .not('eliminato_il', 'is', null)
    .gte('inizio', '2026-03-24T00:00:00')
    .lte('inizio', '2026-03-24T23:59:59');

  if (findError) return console.error('Error finding records:', findError);

  console.log(`Found ${softDeleted.length} soft-deleted records today.`);
  
  if (softDeleted.length > 0) {
    const ids = softDeleted.map(a => a.id);
    console.log('Deleting IDs:', ids);
    const { error: deleteError } = await supabase
      .from('appuntamenti')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('FAILED TO PHYSICALLY DELETE:', deleteError);
    } else {
      console.log('SUCCESSFULLY DELETED RECORDS PERMANENTLY.');
    }
  } else {
    console.log('No soft-deleted records found for today.');
  }
}

purge();
