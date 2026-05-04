const { Resend } = require('resend');
const resend = new Resend('re_2aNX2J9m_5yMAz1C6ZrrKrAZXLoyNgcG8');

const SENDER = 'Autoscuola Toscana <notifiche@guide.autoscuolatoscanasnc.it>';
const TO = 'manueleautoscuola@gmail.com';

async function sendForwardEmail() {
  console.log('Inviando credenziali Segreteria a Manuele...');

  try {
    await resend.emails.send({
      from: SENDER,
      to: [TO],
      subject: 'DA INOLTRARE: Credenziali Accesso Segreteria Colle',
      html: `
        <div style="font-family: sans-serif; padding: 30px; border: 2px solid #0ea5e9; border-radius: 24px;">
          <h2 style="color: #0ea5e9;">Credenziali Segreteria Colle</h2>
          <p>Ciao Manuele, invia queste credenziali alla Segreteria (dato che Libero blocca le nostre mail):</p>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 16px; margin: 20px 0;">
            <p><strong>Email:</strong> autoscuolatoscana@libero.it</p>
            <p><strong>Password:</strong> Guide-2026!</p>
            <p><strong>Link Accesso:</strong> <a href="https://agenda-guide-manu.vercel.app/login">Accedi all'Agenda</a></p>
          </div>

          <p style="font-size: 14px; color: #64748b;">Dì loro di installare l'app aggiungendo la pagina alla schermata Home del loro telefono/PC.</p>
        </div>
      `
    });
    console.log('✅ Email inviata a Manuele.');
  } catch (e) {
    console.error('❌ Errore:', e);
  }
}

sendForwardEmail();
