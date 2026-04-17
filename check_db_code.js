const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
