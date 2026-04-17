const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
