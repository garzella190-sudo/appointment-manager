const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://cpdmlnxquybciajkqkhr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZG1sbnhxdXliY2lhamtxa2hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4OTM3NSwiZXhwIjoyMDg4NjY1Mzc1fQ.WLJ-JlDK6e8_wRksIBRlxi9CNPlh4oGLx4PsklWEzjY'
);

async function check() {
  const day = '2026-03-24';
  
  const { data: apts } = await supabase
    .from('appuntamenti')
    .select('*')
    .gte('inizio', `${day}T00:00:00Z`)
    .lte('inizio', `${day}T23:59:59Z`);

  const { data: impegni } = await supabase
    .from('impegni')
    .select('*')
    .eq('data', day);

  console.log('--- APPUNTAMENTI ---');
  console.log(JSON.stringify(apts, null, 2));
  console.log('\n--- IMPEGNI ---');
  console.log(JSON.stringify(impegni, null, 2));
}

check();
