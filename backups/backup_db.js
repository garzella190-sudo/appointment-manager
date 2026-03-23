/**
 * backup_db.js — Esporta tutti i dati da Supabase in file JSON locali
 * 
 * Uso: node backups/backup_db.js
 * 
 * Legge le credenziali da .env.local (deve essere eseguito dalla root del progetto)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Legge .env.local manualmente
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Rimuove virgolette
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('❌ Variabili SUPABASE mancanti in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const timestamp = new Date().toISOString().split('T')[0];
  const outDir = path.join(__dirname, `backup_${timestamp}`);
  
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const tables = ['clienti', 'istruttori', 'veicoli', 'patenti', 'appuntamenti'];

  console.log(`\n📦 Backup Supabase → ${outDir}\n`);

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.error(`  ❌ ${table}: ${error.message}`);
        continue;
      }
      const filePath = path.join(outDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`  ✅ ${table}: ${data.length} record`);
    } catch (err) {
      console.error(`  ❌ ${table}: ${err.message}`);
    }
  }

  console.log(`\n✅ Backup completato in: ${outDir}\n`);
}

main().catch(err => {
  console.error('Errore fatale:', err);
  process.exit(1);
});
