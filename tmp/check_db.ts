import { createClient } from '@supabase/supabase-js';

async function check() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.error('Missing Supabase URL or Key in environment');
    return;
  }

  const supabase = createClient(url, key);
  
  const { data, error } = await supabase.from('clienti').select('*').limit(1);
  if (error) {
    console.error('Error fetching from clienti:', error.message);
  } else {
    console.log('Columns in clienti:', Object.keys(data[0] || {}));
  }
}
check();
