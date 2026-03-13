
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
  console.log('Available definitions:', Object.keys(data.definitions || {}));
}

getDocs();
