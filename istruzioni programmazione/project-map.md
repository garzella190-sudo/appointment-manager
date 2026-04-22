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
- `/src/components/forms/AppointmentForm.tsx` -> Logica di business per calcolo orari e compatibilità.
- `/src/app/api/cron/reminders/route.ts` -> **Cron Reminders**: Gestione automatizzata invio promemoria (Domani).
- `/src/actions/notifications.ts` -> **Notification Hub**: Logica centralizzata Resend e template email.

## 🎨 Token di Stile
- `/src/app/globals.css` -> Definizione border-radius (32px/40px) e scrollbar overrides.
- `tailwind.config.ts` -> Palette colori basata sugli istruttori.
