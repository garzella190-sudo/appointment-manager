const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carica variabili da .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const env = loadEnv();
const resendApiKey = env.RESEND_API_KEY;
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!resendApiKey || !supabaseUrl || !supabaseKey) {
  console.error("❌ Variabili d'ambiente mancanti in .env.local");
  process.exit(1);
}

const resend = new Resend(resendApiKey);
const supabase = createClient(supabaseUrl, supabaseKey);

const SENDER = 'Autoscuola Toscana <notifiche@guide.autoscuolatoscanasnc.it>';
const PDF_PATH = path.join(__dirname, '..', 'documenti_pdf', 'Accesso_App_Agenda.pdf');

function getEmailHtml(name, email) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f4f4f5; }
      .container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
      .header { background: linear-gradient(135deg, #0ea5e9, #2563eb); padding: 36px 30px; text-align: center; }
      .header h1 { color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
      .header p { color: #bae6fd; margin: 8px 0 0; font-size: 15px; }
      .content { padding: 36px 30px; }
      .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 22px; margin: 20px 0; }
      .credential { margin-bottom: 12px; font-size: 15px; }
      .credential strong { color: #0284c7; }
      .credential span { background-color: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 8px; font-family: monospace; font-size: 16px; font-weight: bold; margin-left: 8px; }
      .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 15px; text-align: center; margin-top: 10px; }
      .pdf-box { background: #f0fdf4; border: 1.5px dashed #16a34a; border-radius: 14px; padding: 16px; margin: 20px 0; font-size: 14px; color: #166534; }
      .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; background-color: #f8fafc; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Nuova Agenda Guide</h1>
        <p>Autoscuola Toscana</p>
      </div>
      
      <div class="content">
        <p style="font-size: 17px; font-weight: 700; color: #0f172a;">Ciao ${name},</p>
        <p style="font-size: 15px; color: #475569;">
          È attiva la nuova <strong>Agenda Digitale delle Guide</strong> di Autoscuola Toscana. Da oggi potrai visualizzare e gestire il calendario delle guide direttamente dal tuo smartphone.
        </p>
        
        <div class="card">
          <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">I tuoi dati di accesso:</h3>
          <div class="credential">
            Email: <span>${email}</span>
          </div>
          <div class="credential">
            Password: <span>Guide-2026!</span>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <a href="https://agenda-guide-manu.vercel.app/login" class="btn">Accedi all'Agenda</a>
          </div>
        </div>

        <div class="pdf-box">
          📎 <strong>Istruzioni in Allegato:</strong><br>
          In allegato a questa email trovi il documento PDF <strong>"Accesso_App_Agenda.pdf"</strong> con il <strong>QR Code</strong> per accedere subito e la guida per <strong>installare l'icona dell'applicazione sulla schermata del telefono</strong> (sia per iPhone sia per Android).
        </div>
      </div>
      
      <div class="footer">
        Autoscuola Toscana © 2026 — Documento riservato allo Staff
      </div>
    </div>
  </body>
  </html>
  `;
}

async function sendToUser(user, pdfBuffer) {
  const email = user.email;
  const name = user.user_metadata?.full_name || user.email.split('@')[0];

  try {
    const data = await resend.emails.send({
      from: SENDER,
      to: [email],
      subject: 'Istruzioni e Accesso Nuova Agenda Guide — Autoscuola Toscana',
      html: getEmailHtml(name, email),
      attachments: [
        {
          filename: 'Accesso_App_Agenda.pdf',
          content: pdfBuffer
        }
      ]
    });
    console.log(`✅ Email inviata con successo a ${name} (${email}) - ID:`, data.data?.id);
    return true;
  } catch (err) {
    console.error(`❌ Errore durante l'invio a ${name} (${email}):`, err.message);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`❌ File PDF non trovato in ${PDF_PATH}`);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(PDF_PATH);
  console.log(`📄 PDF caricato: Accesso_App_Agenda.pdf (${pdfBuffer.length} bytes)`);

  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error || !users) {
    console.error("❌ Impossibile recuperare gli utenti da Supabase:", error);
    process.exit(1);
  }

  const isTest = process.argv.includes('--test');

  if (isTest) {
    const testEmail = 'manueleautoscuola@gmail.com';
    const testUser = users.find(u => u.email.toLowerCase() === testEmail) || {
      email: testEmail,
      user_metadata: { full_name: 'Manuele Garzella' }
    };
    console.log(`\n🧪 Modalità TEST: Invio email di prova ESCLUSIVAMENTE a ${testEmail}...`);
    await sendToUser(testUser, pdfBuffer);
    console.log("\n🧪 Test completato. Se l'email ricevuta è corretta, puoi procedere all'invio per tutto lo staff con --all.\n");
    return;
  }

  const isAll = process.argv.includes('--all');
  if (!isAll) {
    console.log("\n⚠️ Per avviare l'invio reale:")
    console.log("   - Per testare prima sulla tua email: node scripts/send_instructions_pdf.js --test");
    console.log("   - Per inviare a tutti gli utenti:    node scripts/send_instructions_pdf.js --all\n");
    return;
  }

  console.log(`\n📬 Invio massivo a ${users.length} utenti staff in corso...\n`);
  for (const user of users) {
    await sendToUser(user, pdfBuffer);
  }
  console.log("\n✨ Operazione completata per tutti gli utenti!\n");
}

main().catch(err => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
