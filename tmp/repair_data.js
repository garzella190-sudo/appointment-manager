const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://cpdmlnxquybciajkqkhr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZG1sbnhxdXliY2lhamtxa2hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4OTM3NSwiZXhwIjoyMDg4NjY1Mzc1fQ.WLJ-JlDK6e8_wRksIBRlxi9CNPlh4oGLx4PsklWEzjY'
);

async function run() {
  console.log('--- Checking & Repairing data_solo ---');
  
  // 1. Fetch all active appointments
  const { data: apts, error } = await supabase
    .from('appuntamenti')
    .select('id, inizio, data_solo')
    .is('eliminato_il', null);

  if (error) {
    console.error('Error fetching appointments:', error);
    return;
  }

  let repairedCount = 0;
  for (const apt of apts) {
    // 2. Calculate the correct local date string (YYYY-MM-DD) from the UTC 'inizio' timestamp
    // Assuming Italy time (UTC+1 or UTC+2). A robust way in JS without external libs:
    const d = new Date(apt.inizio);
    // Convert to Italian locale string and then parse it back, or just use the ISO string if it's close enough. 
    // Actually, adjusting for timezone offset manually is safer if we just want the date part:
    // JS Date outputs localized strings based on the system running it (which here is arbitrary).
    // Let's use string manipulation assuming the 'inizio' stores the correct local time intention but maybe shifted
    // Let's use date-fns logic equivalent:
    
    // Quick and safe: get the local date parts (assuming the database 'inizio' was inserted as UTC equivalent of local time)
    // Wait, if it was inserted as UTC, '2026-03-24T09:00:00+00:00' -> we want "2026-03-24".
    // If it was '2026-03-23T23:00:00+00:00' intended for '2026-03-24T00:00:00' it's tricky.
    // Let's output all mismatches first to see what we are dealing with.
    
    const isoDatePart = apt.inizio.substring(0, 10);
    if (apt.data_solo !== isoDatePart) {
      console.log(`Mismatch found for ${apt.id}: inizio=${apt.inizio}, data_solo=${apt.data_solo}. Updating data_solo to ${isoDatePart}`);
      const { error: updateError } = await supabase
        .from('appuntamenti')
        .update({ data_solo: isoDatePart })
        .eq('id', apt.id);
        
      if (updateError) console.error(`Error updating ${apt.id}:`, updateError);
      else repairedCount++;
    }
  }

  console.log(`Repaired ${repairedCount} appointments.`);
  
  // 3. Purge legacy impegni table just in case it's confusing the UI or backend (though we verified it's empty, good to be sure)
  console.log('\n--- Ensuring legacy impegni table is fully purged ---');
  const { error: deleteError } = await supabase.from('impegni').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteError) console.error('Error purging impegni:', deleteError);
  else console.log('Legacy impegni table purged.');
}

run();
