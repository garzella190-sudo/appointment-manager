const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch[1].replace(/["']/g, "").trim();
const supabaseKey = supabaseKeyMatch[1].replace(/["']/g, "").trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('istruttori')
    .select('id, nome, cognome');
  console.log('Istruttori error:', error);
  console.log('Istruttori:', JSON.stringify(data, null, 2));
}
check();
