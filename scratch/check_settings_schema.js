const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.from('impostazioni_sistema').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Current columns in impostazioni_sistema:", Object.keys(data[0] || {}));
}

checkSchema();
