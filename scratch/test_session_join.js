const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, data,
      sessioni_esame (
        id, nome,
        clienti ( nome, cognome )
      )
    `)
    .not('sessione_esame_id', 'is', null)
    .limit(1);

  console.log('Data:', JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);
}

test();
