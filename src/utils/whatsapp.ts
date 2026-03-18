/**
 * Genera il link corretto per WhatsApp (Standard o Business) in base al dispositivo.
 * Gestisce Intent Android e Schemi Custom iOS per forzare l'apertura dell'app corretta.
 */
export const generateWhatsAppLink = (phone: string, isBusiness: boolean = false): string => {
  // Pulisci il numero mantenendo solo i numeri
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Aggiungi il prefisso internazionale se manca (Istruttore/Cliente default Italia 39)
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

  if (isBusiness) {
    if (isAndroid) {
      // FORZATURA ANDROID: Usa l'intent specifico per il pacchetto Business (com.whatsapp.w4b)
      return `intent://send/?phone=${cleanPhone}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end;`;
    }
    if (isIOS) {
       // FORZATURA iOS: Usa lo schema custom diretto invece dell'universal link wa.me
       return `whatsapp://send?phone=${cleanPhone}`;
    }
    // Fallback Desktop per Business (apre il portale web/desktop)
    return `https://api.whatsapp.com/send?phone=${cleanPhone}`;
  }

  // Comportamento Standard (Personale) - Utilizza wa.me che è l'universal link ufficiale
  return `https://wa.me/${cleanPhone}`;
};
