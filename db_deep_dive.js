const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- SEARCHING FOR CUSTOM DB LOGIC ---');

  // Try to find functions with the word "sovrapposizione"
  // Note: we might not have permission to system tables, but let's try.
  
  const queries = [
    {
       name: 'Custom Functions',
       sql: "SELECT proname, prosrc FROM pg_proc WHERE prosrc ILIKE '%sovrapposizione%'"
    },
    {
       name: 'Triggers on appuntamenti',
       sql: "SELECT tgname FROM pg_trigger WHERE tgrelid = 'appuntamenti'::regclass"
    },
    {
       name: 'Constraints on appuntamenti',
       sql: "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'appuntamenti'::regclass"
    }
  ];

  for (const q of queries) {
    console.log(`\nExecuting: ${q.name}...`);
    // Note: Supabase doesn't allow direct SQL via .from() or .rpc() usually for system tables
    // unless we have a specific RPC defined.
    // Let's try to see if there's any RPC we can use.
  }
  
  // Actually, let's try to query 'appuntamenti' structure to see if there are any non-standard columns or constraints
  const { data: columns, error: colError } = await supabase.from('appuntamenti').select('*').limit(1);
  if (columns && columns.length > 0) {
    console.log('Sample record columns:', Object.keys(columns[0]));
  }
}

check();
