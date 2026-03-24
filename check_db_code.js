const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://cpdmlnxquybciajkqkhr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZG1sbnhxdXliY2lhamtxa2hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4OTM3NSwiZXhwIjoyMDg4NjY1Mzc1fQ.WLJ-JlDK6e8_wRksIBRlxi9CNPlh4oGLx4PsklWEzjY'
);

async function check() {
  const { data, error } = await supabase.rpc('get_table_triggers', { table_name: 'appuntamenti' });
  if (error) {
    // try direct SQL if RPC doesn't exist (unlikely to work unless enabled)
    console.log('RPC get_table_triggers failed, trying query...');
    const { data: d2, error: e2 } = await supabase.from('pg_trigger').select('*').limit(1);
    console.log('Direct pg_trigger access:', e2 ? 'DENIED' : 'ALLOWED');
  } else {
    console.log('Triggers:', data);
  }

  // Also check for function definitions that might contain the string
  const { data: functions, error: funcError } = await supabase
    .from('_functions_source') // This is a guess, usually not accessible
    .select('*')
    .ilike('source', '%SOVRAPPOSIZIONE%');
  
  if (funcError) console.log('Functions search denied/failed');
}

check();
