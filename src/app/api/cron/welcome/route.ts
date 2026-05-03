import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const SENDER = 'Autoscuola Toscana <notifiche@guide.autoscuolatoscanasnc.it>';
const REPORT_EMAIL = 'manueleautoscuola@gmail.com';

function getWelcomeHtml(name: string, email: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #0ea5e9, #2563eb); padding: 40px 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { color: #bae6fd; margin: 10px 0 0; font-size: 16px; }
        .content { padding: 40px 30px; }
        .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin: 24px 0; }
        .credential { margin-bottom: 12px; font-size: 16px; }
        .credential strong { color: #0ea5e9; }
        .credential span { background-color: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 8px; font-family: monospace; font-size: 18px; font-weight: bold; margin-left: 8px; }
        .btn { display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 16px; text-align: center; margin-top: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.2); }
        .instructions { margin-top: 30px; padding-top: 30px; border-top: 1px solid #e2e8f0; }
        .instructions h3 { color: #0f172a; margin-top: 0; }
        .step { display: flex; align-items: flex-start; margin-bottom: 16px; }
        .step-icon { font-size: 20px; margin-right: 12px; background: #f1f5f9; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 10px; flex-shrink: 0; }
        .footer { text-align: center; padding: 20px; font-size: 13px; color: #94a3b8; background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nuova Agenda Guide</h1>
          <p>Autoscuola Toscana</p>
        </div>
        
        <div class="content">
          <p style="font-size: 18px; font-weight: 600; color: #0f172a;">Ciao ${name},</p>
          <p style="font-size: 16px; color: #475569;">Siamo pronti a partire! Il tuo account per la nuova Agenda Digitale è stato configurato ed è pronto per l'uso.</p>
          
          <div class="card">
            <h3 style="margin-top: 0; color: #0f172a; font-size: 18px;">I tuoi dati di accesso:</h3>
            <div class="credential">
              Email: <span>${email}</span>
            </div>
            <div class="credential">
              Password: <span>Guide-2026!</span>
            </div>
            <div style="text-align: center; margin-top: 24px;">
              <a href="https://agenda-guide-manu.vercel.app/login" class="btn">Accedi all'Agenda</a>
            </div>
          </div>

          <div class="instructions">
            <h3>📱 Come installare l'App (PWA) sul telefono:</h3>
            <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">L'agenda non si scarica dagli Store, ma si installa direttamente dal browser per avere l'icona sul telefono.</p>
            
            <div class="step">
              <div class="step-icon">🍎</div>
              <div>
                <strong style="color: #334155;">Su iPhone / iPad (Safari)</strong><br>
                <span style="color: #64748b; font-size: 14px;">Apri il link con Safari, tocca il tasto <strong>Condividi</strong> (il quadrato con la freccia in basso al centro) e scegli <strong>"Aggiungi alla schermata Home"</strong>.</span>
              </div>
            </div>
            
            <div class="step">
              <div class="step-icon">🤖</div>
              <div>
                <strong style="color: #334155;">Su Android (Chrome)</strong><br>
                <span style="color: #64748b; font-size: 14px;">Apri il link con Chrome, tocca i <strong>tre puntini</strong> in alto a destra e seleziona <strong>"Aggiungi a schermata Home"</strong> o "Installa app".</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="footer">
          Autoscuola Toscana © 2026
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = createAdminClient();

  // 1. Fetch users
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error || !users) {
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }

  const report = [];
  
  for (const user of users) {
    const email = user.email;
    const name = user.user_metadata?.full_name || 'Staff';
    
    if (!email) continue;
    
    // Skip Manuele (already sent test)
    if (email.toLowerCase() === REPORT_EMAIL.toLowerCase()) {
      report.push(`Skipped ${email} (Master User)`);
      continue;
    }

    try {
      await resend.emails.send({
        from: SENDER,
        to: [email],
        subject: 'Benvenuto nella Nuova Agenda Digitale - Dati di Accesso',
        html: getWelcomeHtml(name, email),
        text: `Ciao ${name}, benvenuto nella nuova Agenda Digitale. Email: ${email}, Password: Guide-2026!. Accedi qui: https://agenda-guide-manu.vercel.app/login`
      });
      report.push(`✅ Sent to ${name} (${email})`);
    } catch (err: any) {
      report.push(`❌ Failed for ${email}: ${err.message}`);
    }
  }

  // 2. Send final report to Manuele
  try {
    await resend.emails.send({
      from: SENDER,
      to: [REPORT_EMAIL],
      subject: 'REPORT: Invio Email di Benvenuto Completato',
      html: `
        <h2>Report Invio Benvenuto</h2>
        <p>L'invio massivo delle email di benvenuto è terminato.</p>
        <ul>
          ${report.map(line => `<li>${line}</li>`).join('')}
        </ul>
      `
    });
  } catch (e) {
    console.error("Failed to send report", e);
  }

  return NextResponse.json({ success: true, report });
}
