const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch[1].trim();
const supabaseKey = supabaseKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('appuntamenti')
    .select('id, data, inizio, fine, sessione_esame_id, note, stato')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('Appuntamenti error:', error);
  console.log('Appuntamenti:', JSON.stringify(data, null, 2));
}
check();
