# Project Map - Appointment Manager

Mappa aggiornata dei file core e delle loro dipendenze dopo il restyling "Ultra-Compact".

## 🛣️ Percorsi App Router (Core)
- `/src/app/page.tsx` -> **Agenda** (Home Page, scroll automatico a "Now").
- `/src/app/calendar/page.tsx` -> **Calendario** (Griglia interattiva con granularità 15/30/60m).
- `/src/app/clienti/page.tsx` -> Lista e gestione anagrafiche.
- `/src/app/esami/page.tsx` -> **Esami** (Creazione sedute, assegnazione allievi pronti e istruttori).
- `/src/app/gestione/page.tsx` -> Pannello Admin (Istruttori, Veicoli, Patenti).

## 🧩 Componenti Chiave
- `/src/components/BottomNav.tsx` -> **Master Nav**: Gestisce Profilo Utente, Navigazione e Logout.
- `/src/app/layout.tsx` -> **Shell Globale**: Gestisce il recupero sessione utente e lo scroll-lock dello sfondo.
- `/src/components/modals/NewAppointmentModal.tsx` -> Master per la creazione guide.
- `/src/components/modals/ExamSessionModal.tsx` -> Gestore sedute d'esame (candidati, istruttori, veicoli impegnati).
- `/src/components/forms/AppointmentForm.tsx` -> Logica di business per calcolo orari, compatibilità, ordinamento intelligente nomi impegni (tuoi prima degli altri) e chiusura dropdown click-outside.
- `/src/app/api/cron/reminders/route.ts` -> **Cron Reminders**: Gestione automatizzata invio promemoria (Domani).
- `/src/app/api/cron/welcome/route.ts` -> **Cron Welcome**: Invio una tantum dei dati di accesso allo staff con report finale.
- `/src/actions/notifications.ts` -> **Notification Hub**: Logica centralizzata Resend e template email.
- `/src/lib/pushHelper.ts` -> **Push Helper & Service**: Servizio VAPID per le notifiche web push con instradamento selettivo.
- `/src/actions/appointments.ts` -> **Appointment Server Actions**: Gestione guide ed impegni con invio push mirato per Manuele Garzella.
- `/src/actions/impegni.ts` -> **Commitment Server Actions**: Logica impegni con notifiche push selettive in caso di modifiche dell'ufficio.

## 🎨 Token di Stile
- `/src/app/globals.css` -> Definizione border-radius (32px/40px) e scrollbar overrides.
- `tailwind.config.ts` -> Palette colori basata sugli istruttori.
