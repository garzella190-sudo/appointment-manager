const { Resend } = require('resend');

const resend = new Resend('re_2aNX2J9m_5yMAz1C6ZrrKrAZXLoyNgcG8');
const SENDER = 'Autoscuola Toscana <notifiche@guide.autoscuolatoscanasnc.it>';
const TO = 'manueleautoscuola@gmail.com';

async function sendTestEmails() {
  console.log('Inviando TEST 4 (Forzatura Content-Type) a:', TO);

  const now = new Date();
  const formatICS = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  
  const startTime = new Date();
  startTime.setDate(startTime.getDate() + 1);
  startTime.setHours(12, 0, 0, 0); // 12:00 UTC
  
  const endTime = new Date(startTime.getTime() + 60 * 60000);

  const startStr = formatICS(startTime);
  const endStr = formatICS(endTime);
  const nowStr = formatICS(now);

  const googleUrl = `https://calendar.google.com/calendar/r/eventedit?text=Lezione+di+Guida+TEST+4&dates=${startStr}/${endStr}&details=Test+di+integrazione+calendario+v4&location=Autoscuola+Toscana+Fauglia&sprop=name:Autoscuola%20Toscana`;

  // 4. Mail di Conferma Appuntamento (TEST 4)
  try {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Autoscuola Toscana Fauglia//IT',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:apt-test-4-${Date.now()}@autoscuola.toscana`,
      `DTSTAMP:${nowStr}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:Lezione di Guida (TEST 4)`,
      `DESCRIPTION:Integrazione con Content-Type forzato.`,
      'LOCATION:Autoscuola Toscana Fauglia',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const appointmentResult = await resend.emails.send({
      from: SENDER,
      to: TO,
      subject: 'TEST 4: Notifica Guida con Calendario',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 24px; padding: 30px;">
          <h2 style="color: #2563eb; margin-top: 0;">Test 4: Verifica Finale</h2>
          <p>Ciao Manuele, prova a cliccare sul pulsante blu o ad aprire l'allegato:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${googleUrl}" target="_blank" style="background-color: #4285F4; color: white; padding: 14px 28px; border-radius: 14px; text-decoration: none; font-weight: bold; font-size: 16px;">
              📅 AGGIUNGI A CALENDARIO
            </a>
          </div>

          <p style="font-size: 13px; color: #64748b;">Se il pulsante sopra apre Google Calendar correttamente, abbiamo risolto! Altrimenti fammi sapere cosa vedi cliccando sull'allegato <strong>guida.ics</strong>.</p>
        </div>
      `,
      attachments: [
        {
          filename: 'guida.ics',
          content: Buffer.from(icsContent).toString('base64'),
          contentType: 'text/calendar'
        }
      ]
    });
    console.log('✅ Mail di test 4 inviata:', appointmentResult);
  } catch (e) {
    console.error('❌ Errore mail test 4:', e);
  }
}

sendTestEmails();
