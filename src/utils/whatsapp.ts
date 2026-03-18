/**
 * Genera il link corretto per WhatsApp (Standard o Business) in base al dispositivo.
 * Gestisce Intent Android e Schemi Custom iOS per forzare l'apertura dell'app corretta.
 */
export const generateWhatsAppLink = (phone: string, isBusiness: boolean = false): string => {
  // Pulisci il numero mantenendo solo i numeri
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Aggiungi il prefisso internazionale se manca (presumiamo Italia 39)
  if (!cleanPhone.startsWith('39') && cleanPhone.length >= 9) {
    cleanPhone = `39${cleanPhone}`;
  }

  // Prevenzione errori lato server (Next.js SSR)
  if (typeof window === 'undefined') {
    return `https://wa.me/${cleanPhone}`;
  }

  const userAgent = navigator.userAgent || '';
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

  // LOGICA ANDROID: Forza il pacchetto specifico se possibile
  if (isAndroid) {
    if (isBusiness) {
      // FORZATURA ANDROID BUSINESS: Usa l'intent specifico per w4b
      return `intent://send?phone=${cleanPhone}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end;`;
    } else {
      // FORZATURA ANDROID STANDARD: Usa l'intent specifico per whatsapp classico
      return `intent://send?phone=${cleanPhone}#Intent;package=com.whatsapp;scheme=whatsapp;end;`;
    }
  }

  // LOGICA BUSINESS (ALTRI DISPOSITIVI)
  if (isBusiness) {
    if (isIOS) {
       // FORZATURA iOS: Usa lo schema custom diretto invece dell'universal link wa.me
       return `whatsapp://send?phone=${cleanPhone}`;
    }
    // Fallback Desktop per Business (apre il portale web/desktop)
    return `https://api.whatsapp.com/send?phone=${cleanPhone}`;
  }

  // COMPORTAMENTO STANDARD (Personale) - Utilizza wa.me
  return `https://wa.me/${cleanPhone}`;
};
