/**
 * Generatore delle icone delle notifiche push.
 *
 * Perché serve: le notifiche push hanno DUE icone diverse e non sono intercambiabili.
 *  - `icon`  → immagine GRANDE, a colori (Android, desktop). Qui: il cono arancione.
 *  - `badge` → icona PICCOLA della barra di stato Android: deve essere una SILHOUETTE
 *              MONOCROMATICA BIANCA su sfondo TRASPARENTE. Se le si passa l'icona
 *              dell'app (JPEG con fondo bianco) Android la riduce a un quadratino bianco.
 *
 * Uso:  node scripts/genera_icone_notifica.js
 * Output:
 *  - public/notification-icon.png  (256×256, cono a colori su fondo trasparente)
 *  - public/notification-badge.png (96×96, cono bianco monocromatico, trasparente)
 *
 * Nessuna dipendenza esterna: PNG scritto a mano (zlib + CRC32) e disegno con
 * supersampling 4× per bordi morbidi.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── PNG (RGBA 8 bit) ─────────────────────────────────────────────
const TABELLA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dati) {
  const lunghezza = Buffer.alloc(4);
  lunghezza.writeUInt32BE(dati.length, 0);
  const nomeTipo = Buffer.from(tipo, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([nomeTipo, dati])), 0);
  return Buffer.concat([lunghezza, nomeTipo, dati, crc]);
}

function scriviPng(larghezza, altezza, rgba) {
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(larghezza, 0);
  ihdr.writeUInt32BE(altezza, 4);
  ihdr[8] = 8; // bit per canale
  ihdr[9] = 6; // RGBA
  const rigaByte = larghezza * 4 + 1;
  const raw = Buffer.alloc(rigaByte * altezza);
  for (let y = 0; y < altezza; y++) {
    raw[y * rigaByte] = 0; // filtro "none"
    rgba.copy(raw, y * rigaByte + 1, y * larghezza * 4, (y + 1) * larghezza * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([firma, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── Disegno del cono ─────────────────────────────────────────────
const ARANCIONE = [249, 115, 22]; // #F97316
const BIANCO = [255, 255, 255];
const ROSSO = [220, 38, 38]; // #DC2626
const BASE_SCURA = [153, 27, 27]; // #991B1B

// Geometria in coordinate normalizzate (0..1, y verso il basso)
const APICE_Y = 0.12;
const BASE_Y = 0.78;
const SEMI_LARGHEZZA_BASE = 0.225;
const PIASTRA = { x0: 0.14, x1: 0.86, y0: 0.775, y1: 0.885, raggio: 0.035 };

/** Fascia del cono in base all'altezza: riproduce il logo (arancio / bianco / arancio / bianco / rosso) */
function coloreCono(y) {
  if (y < 0.32) return ARANCIONE;
  if (y < 0.425) return BIANCO;
  if (y < 0.53) return ARANCIONE;
  if (y < 0.635) return BIANCO;
  return ROSSO;
}

function dentroPiastra(x, y) {
  const { x0, x1, y0, y1, raggio } = PIASTRA;
  if (y < y0 || y > y1 || x < x0 || x > x1) return false;
  const cx = Math.min(Math.max(x, x0 + raggio), x1 - raggio);
  const cy = Math.min(Math.max(y, y0 + raggio), y1 - raggio);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= raggio * raggio;
}

/** Larghezza (semi) del cono all'altezza y: triangolo con punta leggermente arrotondata */
function semiLarghezzaCono(y) {
  if (y < APICE_Y || y > BASE_Y) return 0;
  const t = (y - APICE_Y) / (BASE_Y - APICE_Y);
  return SEMI_LARGHEZZA_BASE * Math.pow(t, 0.92); // punta un po' più piena
}

/** Colore+alpha di un punto campionato. monocromatico = silhouette bianca (per il badge) */
function campiona(x, y, monocromatico) {
  const dentroCono = Math.abs(x - 0.5) <= semiLarghezzaCono(y);
  if (dentroCono) {
    return { colore: monocromatico ? BIANCO : coloreCono(y), alpha: 1 };
  }
  if (dentroPiastra(x, y)) {
    return { colore: monocromatico ? BIANCO : BASE_SCURA, alpha: 1 };
  }
  return { colore: BIANCO, alpha: 0 };
}

/**
 * Rende l'immagine con supersampling 4×4 (bordi morbidi) e margine interno.
 * `margine` = frazione di lato lasciata vuota attorno al disegno.
 */
function disegna(lato, { monocromatico, margine = 0.06 }) {
  const SS = 4;
  const uscita = Buffer.alloc(lato * lato * 4);
  const scala = 1 - margine * 2;

  for (let py = 0; py < lato; py++) {
    for (let px = 0; px < lato; px++) {
      let sommaA = 0;
      let sommaR = 0;
      let sommaG = 0;
      let sommaB = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = margine + ((px + (sx + 0.5) / SS) / lato) * scala;
          const y = margine + ((py + (sy + 0.5) / SS) / lato) * scala;
          const { colore, alpha } = campiona(x, y, monocromatico);
          sommaA += alpha;
          sommaR += colore[0] * alpha;
          sommaG += colore[1] * alpha;
          sommaB += colore[2] * alpha;
        }
      }

      const campioni = SS * SS;
      const alpha = sommaA / campioni;
      const i = (py * lato + px) * 4;
      if (alpha > 0) {
        uscita[i] = Math.round(sommaR / sommaA);
        uscita[i + 1] = Math.round(sommaG / sommaA);
        uscita[i + 2] = Math.round(sommaB / sommaA);
      }
      uscita[i + 3] = Math.round(alpha * 255);
    }
  }

  return scriviPng(lato, lato, uscita);
}

// ── Scrittura dei file ───────────────────────────────────────────
const destinazione = path.join(process.cwd(), 'public');

const icona = disegna(256, { monocromatico: false, margine: 0.05 });
fs.writeFileSync(path.join(destinazione, 'notification-icon.png'), icona);

const badge = disegna(96, { monocromatico: true, margine: 0.1 });
fs.writeFileSync(path.join(destinazione, 'notification-badge.png'), badge);

console.log('✓ public/notification-icon.png  (%d byte) — cono a colori, trasparente', icona.length);
console.log('✓ public/notification-badge.png (%d byte) — silhouette bianca per Android', badge.length);
