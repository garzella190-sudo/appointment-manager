const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listUsers() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  console.log("ELENCO UTENTI REGISTRATI:");
  console.log("-----------------------------------------");
  users.forEach(u => {
    const name = u.user_metadata?.full_name || 'Staff';
    console.log(`- ${name.padEnd(25)} | ${u.email}`);
  });
  console.log("-----------------------------------------");
  console.log(`Totale: ${users.length} utenti.`);
}

listUsers();
