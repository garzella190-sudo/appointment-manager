
const url = 'https://cpdmlnxquybciajkqkhr.supabase.co/rest/v1/rpc/get_columns';
const key = 'sb_publishable_Mo4r1MQK3Xaa0Z00-MSftA_GAHkVzPL';

// Nota: Questo funzionerebbe solo se esistesse una RPC definita.
// Invece usiamo una query diretta su information_schema se abilitata (spesso no via REST)
// Alternativa: Provare a inserire solo le colonne che c'erano prima.

const urlTable = 'https://cpdmlnxquybciajkqkhr.supabase.co/rest/v1/patenti?select=*&limit=1';

async function check() {
  const response = await fetch(urlTable, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Data sample:', data);
}

check();
