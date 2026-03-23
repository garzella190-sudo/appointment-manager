/**
 * Utility per il calcolo delle festività italiane.
 */

export function isItalianHoliday(date: Date): boolean {
  const day = date.getDate();
  const month = date.getMonth() + 1; // 1-12

  // Festività fisse
  if (day === 1 && month === 1) return true;   // Capodanno
  if (day === 6 && month === 1) return true;   // Epifania
  if (day === 25 && month === 4) return true;  // Liberazione
  if (day === 1 && month === 5) return true;   // Lavoro
  if (day === 2 && month === 6) return true;   // Repubblica
  if (day === 15 && month === 8) return true;  // Ferragosto
  if (day === 1 && month === 11) return true;  // Ognissanti
  if (day === 8 && month === 12) return true;  // Immacolata
  if (day === 25 && month === 12) return true; // Natale
  if (day === 26 && month === 12) return true; // S. Stefano

  // Pasqua e Pasquetta (Algoritmo di Meeus/Jones/Butcher)
  const y = date.getFullYear();
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monthP = Math.floor((h + l - 7 * m + 114) / 31);
  const dayP = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(y, monthP - 1, dayP);
  const easterMonday = new Date(y, monthP - 1, dayP + 1);

  if (isSameDay(date, easter) || isSameDay(date, easterMonday)) return true;

  return false;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}
