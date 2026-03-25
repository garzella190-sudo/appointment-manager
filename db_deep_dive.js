const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://cpdmlnxquybciajkqkhr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZG1sbnhxdXliY2lhamtxa2hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4OTM3NSwiZXhwIjoyMDg4NjY1Mzc1fQ.WLJ-JlDK6e8_wRksIBRlxi9CNPlh4oGLx4PsklWEzjY'
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
