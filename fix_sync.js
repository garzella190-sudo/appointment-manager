const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim().replace(/^"|"$/g, '');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSync() {
  console.log('Fetching all appointments to check for sync issues...');
  
  const { data: appointments, error } = await supabase
    .from('appuntamenti')
    .select('*');

  if (error) {
    console.error('Error fetching appointments:', error);
    return;
  }

  console.log(`Checking ${appointments.length} appointments...`);
  
  let fixedCount = 0;
  for (const apt of appointments) {
    const dataISO = new Date(apt.data).toISOString();
    const inizioISO = apt.inizio ? new Date(apt.inizio).toISOString() : null;
    
    // If data and inizio are different, or inizio is missing
    if (dataISO !== inizioISO) {
      console.log(`Syncing Appointment ${apt.id}:
        Current Data: ${apt.data}
        Current Inizio: ${apt.inizio}
        -> New Inizio: ${apt.data}
      `);
      
      const start = new Date(apt.data);
      const end = new Date(start.getTime() + (apt.durata || 30) * 60000);
      
      const { error: updateError } = await supabase
        .from('appuntamenti')
        .update({
          inizio: start.toISOString(),
          fine: end.toISOString(),
          data_solo: apt.data.split('T')[0]
        })
        .eq('id', apt.id);
        
      if (updateError) {
        console.error(`Failed to update ${apt.id}:`, updateError);
      } else {
        fixedCount++;
      }
    }
  }
  
  console.log(`Finished! Fixed ${fixedCount} appointments.`);
}

fixSync();
