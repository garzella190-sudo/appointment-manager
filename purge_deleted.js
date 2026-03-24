const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://cpdmlnxquybciajkqkhr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZG1sbnhxdXliY2lhamtxa2hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4OTM3NSwiZXhwIjoyMDg4NjY1Mzc1fQ.WLJ-JlDK6e8_wRksIBRlxi9CNPlh4oGLx4PsklWEzjY'
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
