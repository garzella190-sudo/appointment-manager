/**
 * backup_db.js — Esporta tutti i dati da Supabase in file JSON locali
 * 
 * Uso: node backups/backup_db.js
 * 
 * Legge le credenziali da .env.local o da process.env (GitHub Actions)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Legge .env.local manualmente se esiste
function loadEnv() {
  const vars = { ...process.env };
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  }
  return vars;
}

// Fetch con paginazione completa (evita il limite di 1000 righe di default)
async function fetchAllRows(supabase, table) {
  let allRows = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      from += pageSize;
      if (data.length < pageSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('❌ Variabili SUPABASE non trovate (NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY/ANON_KEY)');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const timestamp = new Date().toISOString().split('T')[0];
  const outDir = process.env.BACKUP_DIR || path.join(__dirname, `backup_${timestamp}`);
  
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const tables = [
    'clienti',
    'istruttori',
    'veicoli',
    'patenti',
    'appuntamenti',
    'sessioni_esame',
    'impegni',
    'push_subscriptions'
  ];

  console.log(`\n📦 Avvio Backup Supabase → ${outDir}\n`);
  const report = {};

  for (const table of tables) {
    try {
      const data = await fetchAllRows(supabase, table);
      const filePath = path.join(outDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      report[table] = data.length;
      console.log(`  ✅ ${table}: ${data.length} record esportati`);
    } catch (err) {
      console.error(`  ❌ ${table}: ${err.message}`);
    }
  }

  // File di riepilogo con metadata del backup
  const meta = {
    data_backup: new Date().toISOString(),
    tabelle: report,
    totale_record: Object.values(report).reduce((a, b) => a + b, 0)
  };
  fs.writeFileSync(path.join(outDir, '_metadata.json'), JSON.stringify(meta, null, 2), 'utf-8');

  console.log(`\n✅ Backup completato con successo! Totale record salvati: ${meta.totale_record}\n`);
}

main().catch(err => {
  console.error('Errore fatale:', err);
  process.exit(1);
});
