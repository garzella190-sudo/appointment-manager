const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(resendKey);

function getEmailTemplate(name, dateStr, timeStr) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background: #ffffff; border-radius: 24px; padding: 40px; border: 1px solid #f3f4f6; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: center; }
        .title { color: #6b7280; font-size: 18px; font-weight: 700; margin-bottom: 24px; text-align: center; }
        .subtitle { color: #111827; font-size: 20px; margin-bottom: 40px; text-align: center; white-space: pre-line; font-weight: 600; }
        .footer { text-align: center; margin-top: 40px; color: #9ca3af; font-size: 13px; }
        .disclaimer { color: #ef4444; font-size: 16px; font-weight: 700; text-align: center; line-height: 1.6; margin-bottom: 24px; }
        .contact-info { color: #6b7280; font-size: 16px; font-weight: 500; margin-top: 48px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="title">Promemoria</div>
          <div class="subtitle">Ricorda la guida programmata per ${dateStr} alle ${timeStr}</div>
          <div class="disclaimer">
            NB: le guide vanno disdette 24h prima, pena addebito dell'importo
          </div>
          <div class="contact-info">
            Per disdire le guide chiama in autoscuola oppure contatta il tuo istruttore
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function forceRun() {
  console.log('Forcing remind check for today...');
  
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0,0,0,0);
  
  const todayEnd = new Date(now);
  todayEnd.setHours(23,59,59,999);

  const { data: appointments, error } = await supabase
    .from('appuntamenti')
    .select('id, data, durata, inizio, stato, clienti(nome, email)')
    .eq('send_email', true)
    .neq('stato', 'annullato')
    .gte('inizio', todayStart.toISOString())
    .lte('inizio', todayEnd.toISOString());

  if (error) {
    console.error('DB Error:', error);
    return;
  }

  console.log(`Found ${appointments.length} appointments for today with send_email=true.`);

  for (let apt of appointments) {
    const email = apt.clienti?.email;
    const clientName = apt.clienti?.nome;
    
    if (!email) {
      console.log(`Skipping ${apt.id} - no email`);
      continue;
    }

    const d = new Date(apt.inizio);
    // Format simple
    const dateStr = d.toLocaleDateString('it-IT');
    const timeStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    console.log(`Sending email to ${email} for ${timeStr}...`);

    try {
      await resend.emails.send({
        from: 'Autoscuola Toscana Fauglia <onboarding@resend.dev>',
        to: email,
        subject: 'Promemoria: Lezione di Guida - ' + dateStr + ' alle ' + timeStr,
        html: getEmailTemplate(clientName, dateStr, timeStr)
      });
      console.log(`SUCCESS: ${email}`);
    } catch (e) {
      console.error(`ERROR sending to ${email}:`, e);
    }
  }

  console.log('Done!');
}

forceRun();
