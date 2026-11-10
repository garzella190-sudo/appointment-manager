/**
 * Verifica della logica dei destinatari delle notifiche push.
 * Compila src/lib/pushDestinatari.ts e prova i casi reali dell'autoscuola.
 *
 *   npx tsc src/lib/pushDestinatari.ts --outDir tmp/__destinatari --module commonjs --target es2020 --skipLibCheck
 *   node scripts/verifica_destinatari_push.js
 */
const path = require('path');
const { risolviDestinatariPush } = require(
  path.join(__dirname, '..', 'tmp', '__destinatari', 'pushDestinatari.js')
);

const profili = [
  { id: 'iM', nome: 'Manuele', cognome: 'Garzella', email: 'manueleautoscuola@gmail.com' },
  { id: 'iF', nome: 'Francesco', cognome: 'Rossi', email: 'francesco@x.it' },
];

const utenti = [
  { id: 'uM', email: 'manuele@x.it', user_metadata: { istruttore_id: 'iM', full_name: 'Manuele Garzella', role: 'admin' } },
  { id: 'uF', email: 'francesco@x.it', user_metadata: { istruttore_id: 'iF', full_name: 'Francesco Rossi', role: 'istruttore' } },
  { id: 'uS', email: 'segreteria@x.it', user_metadata: { full_name: 'Segreteria Ufficio', role: 'segreteria' } },
  // account "vecchio" dello stesso istruttore, senza istruttore_id nei metadata
  { id: 'uM2', email: 'garzella@x.it', user_metadata: { full_name: 'manuele garzella' } },
  // AdminDev reale: nessun istruttore_id nei metadata, ma l'email è quella dell'istruttore
  { id: 'uDev', email: 'Manueleautoscuola@gmail.com', user_metadata: { full_name: 'Manuele', role: 'AdminDev' } },
];

const sorted = (set) => [...set].sort().join(',') || '(nessuno)';

const casi = [
  {
    nome: 'Manuele prenota su se stesso',
    atteso: '(nessuno)',
    input: { utenti, profiliCoinvolti: [profili[0]], istruttoriCoinvolti: ['iM'], attoreUserId: 'uM' },
  },
  {
    nome: 'Segreteria prenota su Manuele',
    atteso: 'uDev,uM,uM2',
    input: { utenti, profiliCoinvolti: [profili[0]], istruttoriCoinvolti: ['iM'], attoreUserId: 'uS' },
  },
  {
    nome: 'Manuele prenota su Francesco',
    atteso: 'uF',
    input: { utenti, profiliCoinvolti: [profili[1]], istruttoriCoinvolti: ['iF'], attoreUserId: 'uM' },
  },
  {
    nome: 'Manuele sposta una guida da Francesco al suo calendario',
    atteso: 'uDev,uF,uM2',
    input: { utenti, profiliCoinvolti: profili, istruttoriCoinvolti: ['iM', 'iF'], attoreUserId: 'uM' },
  },
  {
    nome: 'Segreteria sposta una guida da Manuele a Francesco',
    atteso: 'uDev,uF,uM,uM2',
    input: { utenti, profiliCoinvolti: profili, istruttoriCoinvolti: ['iM', 'iF'], attoreUserId: 'uS' },
  },
  {
    nome: 'Account omonimo senza istruttore_id prenota su se stesso',
    atteso: '(nessuno)',
    input: { utenti, profiliCoinvolti: [profili[0]], istruttoriCoinvolti: ['iM'], attoreUserId: 'uM2' },
  },
  {
    nome: 'AdminDev collegato per email prenota sul proprio calendario',
    atteso: '(nessuno)',
    input: { utenti, profiliCoinvolti: [profili[0]], istruttoriCoinvolti: ['iM'], attoreUserId: 'uDev' },
  },
  {
    nome: 'Segreteria prenota su Manuele: avvisati anche gli account collegati (email/nome)',
    atteso: 'uDev,uM,uM2',
    input: { utenti, profiliCoinvolti: [profili[0]], istruttoriCoinvolti: ['iM'], attoreUserId: 'uS' },
  },
  {
    nome: 'Istruttore senza account: nessuno da avvisare',
    atteso: '(nessuno)',
    input: { utenti, profiliCoinvolti: [{ id: 'iX', nome: 'Nuovo', cognome: 'Istruttore' }], istruttoriCoinvolti: ['iX'], attoreUserId: 'uS' },
  },
  {
    nome: 'Calendario non identificato: tutti tranne l autori',
    atteso: 'uDev,uF,uM,uM2',
    input: { utenti, profiliCoinvolti: [], istruttoriCoinvolti: [], attoreUserId: 'uS' },
  },
];

let errori = 0;
for (const caso of casi) {
  const risultato = sorted(risolviDestinatariPush(caso.input));
  const ok = risultato === caso.atteso;
  if (!ok) errori++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${caso.nome}\n     atteso: ${caso.atteso} | ottenuto: ${risultato}`);
}

if (errori > 0) {
  console.error(`\n${errori} caso/i fallito/i`);
  process.exit(1);
}
console.log('\nTutti i casi verificati.');
