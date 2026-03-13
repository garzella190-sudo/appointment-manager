
const url = 'https://cpdmlnxquybciajkqkhr.supabase.co/rest/v1/';
const key = 'sb_publishable_Mo4r1MQK3Xaa0Z00-MSftA_GAHkVzPL';

async function getDocs() {
  const response = await fetch(url, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const data = await response.json();
  const patentiDef = data.definitions.patenti;
  console.log('Patenti table columns:', Object.keys(patentiDef.properties));
}

getDocs();
