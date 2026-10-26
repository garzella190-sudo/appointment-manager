const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const APP_URL = "https://agenda-guide-manu.vercel.app";
const LOGIN_URL = "https://agenda-guide-manu.vercel.app/login";

const USERS = [
  { nome: "Manuele Garzella", email: "manueleautoscuola@gmail.com", ruolo: "Admin / Sviluppatore", badge: "admin", pass: "Guide-2026!" },
  { nome: "Segreteria Colle", email: "autoscuolatoscana@libero.it", ruolo: "Segreteria", badge: "segreteria", pass: "Guide-2026!" },
  { nome: "Valter Pantani", email: "valterpantani@hotmail.it", ruolo: "Istruttore", badge: "istruttore", pass: "Guide-2026!" },
  { nome: "Daniele Caprai", email: "capraidaniele73@gmail.com", ruolo: "Istruttore", badge: "istruttore", pass: "Guide-2026!" },
  { nome: "Riccardo Caprai", email: "caprairiccardo83@gmail.com", ruolo: "Istruttore", badge: "istruttore", pass: "Guide-2026!" },
  { nome: "Francesco Ventre", email: "1968francescoventre@gmail.com", ruolo: "Istruttore", badge: "istruttore", pass: "Guide-2026!" },
  { nome: "Alessandro Carpita", email: "alescar66@gmail.com", ruolo: "Istruttore", badge: "istruttore", pass: "Guide-2026!" }
];

async function generate() {
  const outputDir = path.join(__dirname, '..', 'documenti_pdf');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Genera QR Code in Data URL (PNG ad altissima risoluzione)
  const qrDataUrl = await QRCode.toDataURL(APP_URL, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 12,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  // -------------------------------------------------------------
  // DOCUMENTO 1: ACCESSO ALL'APP CON QR CODE E GUIDA PWA
  // -------------------------------------------------------------
  const html1 = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Accesso Agenda Guide - Autoscuola Toscana</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      line-height: 1.45;
    }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .title-area h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 900;
      color: #0284c7;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .title-area p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
      font-weight: 600;
    }
    .badge-top {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      color: #0369a1;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .main-grid {
      display: flex;
      gap: 24px;
      align-items: center;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .qr-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      padding: 14px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
      flex-shrink: 0;
    }
    .qr-card img {
      width: 170px;
      height: 170px;
      display: block;
    }
    .qr-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin-top: 8px;
    }
    .link-info {
      flex: 1;
    }
    .link-info h2 {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .link-info p {
      margin: 0 0 14px;
      font-size: 13px;
      color: #475569;
    }
    .url-box {
      background: #ffffff;
      border: 1.5px dashed #0284c7;
      padding: 10px 14px;
      border-radius: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      font-weight: 700;
      color: #0369a1;
      word-break: break-all;
    }
    .section-title {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 20px 0 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .instructions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .device-card {
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
      background: #ffffff;
    }
    .device-card.apple {
      border-top: 4px solid #0284c7;
    }
    .device-card.android {
      border-top: 4px solid #10b981;
    }
    .device-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .device-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    .device-step {
      font-size: 12px;
      color: #334155;
      margin-bottom: 8px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .step-num {
      background: #e2e8f0;
      color: #0f172a;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 800;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .notes-box {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 11.5px;
      color: #92400e;
    }
    .notes-box strong {
      color: #78350f;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-area">
      <h1>Autoscuola Toscana</h1>
      <p>Guida Rapida all'Accesso & Installazione Applicazione</p>
    </div>
    <div class="badge-top">Agenda Digitale 2026</div>
  </div>

  <div class="main-grid">
    <div class="qr-card">
      <img src="${qrDataUrl}" alt="QR Code Accesso">
      <div class="qr-label">Inquadra con la fotocamera</div>
    </div>
    <div class="link-info">
      <h2>Accedi all'Applicazione</h2>
      <p>Puoi collegarti all'Agenda delle Guide inquadrando il QR Code con la fotocamera del tuo smartphone, oppure digitando l'indirizzo sottostante nel browser:</p>
      <div class="url-box">${APP_URL}</div>
      <p style="margin-top: 12px; margin-bottom: 0; font-size: 12px; color: #64748b;">
        🔒 <strong>Requisiti:</strong> Utilizza Safari su dispositivi Apple o Google Chrome su dispositivi Android.
      </p>
    </div>
  </div>

  <div class="section-title">📱 Come aggiungere l'icona sul telefono (PWA)</div>

  <div class="instructions-grid">
    <div class="device-card apple">
      <div class="device-header">
        <span style="font-size: 18px;">🍎</span>
        <h3>iPhone & iPad (Safari)</h3>
      </div>
      <div class="device-step">
        <div class="step-num">1</div>
        <div>Inquadra il QR Code o apri il link tramite <strong>Safari</strong>.</div>
      </div>
      <div class="device-step">
        <div class="step-num">2</div>
        <div>Tocca il pulsante <strong>Condividi</strong> (l'icona del quadrato con la freccia verso l'alto in basso al centro).</div>
      </div>
      <div class="device-step">
        <div class="step-num">3</div>
        <div>Scorri le opzioni verso il basso e tocca <strong>"Aggiungi alla schermata Home"</strong>.</div>
      </div>
      <div class="device-step">
        <div class="step-num">4</div>
        <div>Conferma toccando <strong>"Aggiungi"</strong> in alto a destra: troverai l'icona dell'Agenda sul tuo telefono come una vera app.</div>
      </div>
    </div>

    <div class="device-card android">
      <div class="device-header">
        <span style="font-size: 18px;">🤖</span>
        <h3>Smartphone Android (Chrome)</h3>
      </div>
      <div class="device-step">
        <div class="step-num">1</div>
        <div>Inquadra il QR Code o apri il link tramite <strong>Google Chrome</strong>.</div>
      </div>
      <div class="device-step">
        <div class="step-num">2</div>
        <div>Tocca il menu con i <strong>tre puntini</strong> verticali in alto a destra.</div>
      </div>
      <div class="device-step">
        <div class="step-num">3</div>
        <div>Seleziona la voce <strong>"Installa applicazione"</strong> oppure <strong>"Aggiungi a schermata Home"</strong>.</div>
      </div>
      <div class="device-step">
        <div class="step-num">4</div>
        <div>Conferma l'installazione: l'icona dell'applicazione comparirà automaticamente tra le tue app.</div>
      </div>
    </div>
  </div>

  <div class="notes-box">
    <strong>💡 Informazione utile:</strong> L'applicazione si aggiorna in tempo reale senza bisogno di scaricare file dagli store (App Store o Play Store). Ogni volta che viene aperta, carica l'ultima versione disponibile con sincronizzazione immediata del calendario delle guide.
  </div>

  <div class="footer">
    <span>Autoscuola Toscana — Sistema Gestionale Guide</span>
    <span>Documento ad uso interno — Generato il 23/10/2026</span>
  </div>
</body>
</html>`;

  // -------------------------------------------------------------
  // DOCUMENTO 2: ELENCO UTENTI STAFF E PASSWORD
  // -------------------------------------------------------------
  const html2 = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Elenco Utenti e Credenziali - Autoscuola Toscana</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      line-height: 1.45;
    }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .title-area h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .title-area p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
      font-weight: 600;
    }
    .badge-top {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-bar {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .info-bar span strong {
      color: #0284c7;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-bottom: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    td {
      padding: 11px 14px;
      font-size: 12px;
      color: #1e293b;
      border-bottom: 1px solid #f1f5f9;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .user-name {
      font-weight: 700;
      color: #0f172a;
    }
    .user-email {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #0369a1;
      font-size: 11.5px;
      font-weight: 600;
    }
    .user-pass {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      font-weight: 800;
      background: #e0f2fe;
      color: #0369a1;
      padding: 3px 8px;
      border-radius: 6px;
      display: inline-block;
    }
    .badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.3px;
    }
    .badge-admin {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .badge-segreteria {
      background: #ede9fe;
      color: #5b21b6;
      border: 1px solid #ddd6fe;
    }
    .badge-istruttore {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #e2e8f0;
    }
    .security-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 16px;
    }
    .security-box h4 {
      margin: 0 0 6px;
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
    }
    .security-box p {
      margin: 0;
      font-size: 11.5px;
      color: #475569;
      line-height: 1.5;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-area">
      <h1>Autoscuola Toscana</h1>
      <p>Elenco Utenti Staff & Credenziali di Accesso</p>
    </div>
    <div class="badge-top">Riservato & Confidenziale</div>
  </div>

  <div class="info-bar">
    <span>🌐 Pagina di Login: <strong>${LOGIN_URL}</strong></span>
    <span>👥 Totale Utenti Staff: <strong>${USERS.length}</strong></span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Nome / Profilo</th>
        <th style="width: 35%;">Email (Nome Utente)</th>
        <th style="width: 20%;">Ruolo</th>
        <th style="width: 20%;">Password Iniziale</th>
      </tr>
    </thead>
    <tbody>
      ${USERS.map(u => `
      <tr>
        <td><div class="user-name">${u.nome}</div></td>
        <td><div class="user-email">${u.email}</div></td>
        <td>
          <span class="badge ${u.badge === 'admin' ? 'badge-admin' : (u.badge === 'segreteria' ? 'badge-segreteria' : 'badge-istruttore')}">
            ${u.ruolo}
          </span>
        </td>
        <td><span class="user-pass">${u.pass}</span></td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="security-box">
    <h4>Istruzioni di Primo Accesso & Sicurezza:</h4>
    <p>
      1. Collegarsi all'indirizzo di login sopra indicato inserendo la propria <strong>Email</strong> e la <strong>Password Iniziale</strong>.<br>
      2. Ciascun operatore può visualizzare il proprio calendario e le guide assegnate in base al proprio ruolo.<br>
      3. Conservare questo documento in luogo sicuro e non divulgare le password a soggetti estranei all'attività.
    </p>
  </div>

  <div class="footer">
    <span>Autoscuola Toscana — Registro Credenziali Staff</span>
    <span>Documento Riservato — Aggiornato al 23/10/2026</span>
  </div>
</body>
</html>`;

  const htmlPath1 = path.join(outputDir, 'temp_accesso.html');
  const htmlPath2 = path.join(outputDir, 'temp_utenti.html');
  const pdfPath1 = path.join(outputDir, 'Accesso_App_Agenda.pdf');
  const pdfPath2 = path.join(outputDir, 'Elenco_Utenti_Password.pdf');

  fs.writeFileSync(htmlPath1, html1, 'utf-8');
  fs.writeFileSync(htmlPath2, html2, 'utf-8');

  console.log("Generazione PDF 1 (Accesso App & QR Code)...");
  execSync(`"${EDGE_PATH}" --headless --disable-gpu --no-pdf-header-footer --run-all-compositor-stages-before-draw --print-to-pdf="${pdfPath1}" "${htmlPath1}"`);

  console.log("Generazione PDF 2 (Lista Utenti & Password)...");
  execSync(`"${EDGE_PATH}" --headless --disable-gpu --no-pdf-header-footer --run-all-compositor-stages-before-draw --print-to-pdf="${pdfPath2}" "${htmlPath2}"`);

  // Pulizia file temporanei HTML
  if (fs.existsSync(htmlPath1)) fs.unlinkSync(htmlPath1);
  if (fs.existsSync(htmlPath2)) fs.unlinkSync(htmlPath2);

  console.log("\n✅ PDF generati con successo!");
  console.log("📄 1:", pdfPath1, `(${fs.statSync(pdfPath1).size} bytes)`);
  console.log("📄 2:", pdfPath2, `(${fs.statSync(pdfPath2).size} bytes)`);
}

generate().catch(err => {
  console.error("Errore:", err);
  process.exit(1);
});
