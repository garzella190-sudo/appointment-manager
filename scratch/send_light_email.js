const { Resend } = require('resend');
const resend = new Resend('re_2aNX2J9m_5yMAz1C6ZrrKrAZXLoyNgcG8');

const SENDER = 'Autoscuola Toscana <notifiche@guide.autoscuolatoscanasnc.it>';
const TO = 'autoscuolatoscana@libero.it';

async function sendLightEmail() {
  console.log('Inviando versione leggera a:', TO);

  try {
    const result = await resend.emails.send({
      from: SENDER,
      to: [TO],
      subject: 'Dati di Accesso - Nuova Agenda Guide',
      text: `Ciao Segreteria,
      
Siamo pronti a partire con la nuova Agenda Digitale.

Ecco i vostri dati di accesso:
Email: ${TO}
Password: Guide-2026!

Potete accedere da qui:
https://agenda-guide-manu.vercel.app/login

Istruzioni per il telefono:
Aprite il link e aggiungete la pagina alla schermata Home (dal menu di Safari su iPhone o dai tre puntini su Android).

Saluti,
Autoscuola Toscana`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2>Benvenuti nella Nuova Agenda Guide</h2>
          <p>Ecco le vostre credenziali per accedere al sistema:</p>
          <p><strong>Email:</strong> ${TO}<br>
          <strong>Password:</strong> Guide-2026!</p>
          <p>Accedi qui: <a href="https://agenda-guide-manu.vercel.app/login">Login Agenda</a></p>
          <hr>
          <p style="font-size: 12px; color: #777;">Autoscuola Toscana</p>
        </div>
      `
    });
    console.log('✅ Email leggera inviata:', result);
  } catch (e) {
    console.error('❌ Errore invio email leggera:', e);
  }
}

sendLightEmail();
