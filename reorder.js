const fs = require('fs');
const content = fs.readFileSync('src/components/modals/ExamSessionModal.tsx', 'utf-8');
const lines = content.split('\n');

const prima = lines.slice(0, 436);
const istrVeicoli = lines.slice(436, 551);
const candidati = lines.slice(551, 699); 
const dopo = lines.slice(699);

const nuovoContent = [
  ...prima,
  ...candidati,
  ...istrVeicoli,
  ...dopo
].join('\n');

// Update section titles
let finalContent = nuovoContent.replace('{/* SEZIONE 4: CANDIDATI */}', '{/* SEZIONE 2: CANDIDATI */}');
finalContent = finalContent.replace('{/* SEZIONE 2: ISTRUTTORI */}', '{/* SEZIONE 3: ISTRUTTORI */}');
finalContent = finalContent.replace('{/* SEZIONE 3: VEICOLI */}', '{/* SEZIONE 4: VEICOLI */}');

fs.writeFileSync('src/components/modals/ExamSessionModal.tsx', finalContent);
console.log('Reordered successfully!');
