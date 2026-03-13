
const url = 'https://cpdmlnxquybciajkqkhr.supabase.co/rest/v1/patenti';
const key = 'sb_publishable_Mo4r1MQK3Xaa0Z00-MSftA_GAHkVzPL';

const patenti = [
  { tipo: 'AM',  nome_visualizzato: 'Patente AM',  durata_default: 30 },
  { tipo: 'A1',  nome_visualizzato: 'Patente A1',  durata_default: 50 },
  { tipo: 'A2',  nome_visualizzato: 'Patente A2',  durata_default: 50 },
  { tipo: 'A',   nome_visualizzato: 'Patente A',   durata_default: 50 },
  { tipo: 'B1',  nome_visualizzato: 'Patente B1',  durata_default: 50 },
  { tipo: 'B',   nome_visualizzato: 'Patente B',   durata_default: 50 },
  { tipo: 'B96', nome_visualizzato: 'Patente B96', durata_default: 50 },
  { tipo: 'BE',  nome_visualizzato: 'Patente BE',  durata_default: 60 },
  { tipo: 'C1',  nome_visualizzato: 'Patente C1',  durata_default: 90 },
  { tipo: 'C',   nome_visualizzato: 'Patente C',   durata_default: 90 },
  { tipo: 'C1E', nome_visualizzato: 'Patente C1E', durata_default: 90 },
  { tipo: 'CE',  nome_visualizzato: 'Patente CE',  durata_default: 90 },
  { tipo: 'D1',  nome_visualizzato: 'Patente D1',  durata_default: 90 },
  { tipo: 'D',   nome_visualizzato: 'Patente D',   durata_default: 90 },
  { tipo: 'D1E', nome_visualizzato: 'Patente D1E', durata_default: 90 },
  { tipo: 'DE',  nome_visualizzato: 'Patente DE',  durata_default: 90 }
];

async function seed() {
  console.log('Avvio seeding patenti...');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(patenti)
    });

    if (response.ok) {
      console.log('Seeding completato con successo!');
    } else {
      const err = await response.text();
      console.error('Errore durante il seeding:', response.status, err);
    }
  } catch (error) {
    console.error('Errore di rete:', error);
  }
}

seed();
