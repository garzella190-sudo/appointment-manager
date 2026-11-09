# Project Map - Appointment Manager

Mappa aggiornata dei file core e delle loro dipendenze dopo il restyling "Ultra-Compact".

## 🛣️ Percorsi App Router (Core)
- `/src/app/calendar/page.tsx` -> **HOME dell'app / Calendario** (griglia interattiva 15/30/60m, orari fissi a sinistra, intestazioni sticky). Dopo il login si atterra qui; è la `start_url` delle PWA.
- `/src/app/page.tsx` -> **Agenda** (lista del giorno, scroll automatico a "Now", guide raggruppate per istruttore e **affiancate in orizzontale** con righe allineate per orario, picker multi-istruttore dal tasto *people*, **ricerca globale su tutto il calendario** con split future/svolte/annullate e fetch paginato a 1000 righe).
- `/src/lib/preferenzeVista.ts` -> **Preferenze di visualizzazione personali**, condivise fra Agenda e Calendario (chiavi `calendar_*`): gli istruttori scelti in una schermata valgono anche nell'altra; mai resettate automaticamente.
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
- `/src/app/globals.css` -> Definizione border-radius (32px/40px), scrollbar overrides e regole anti-overflow (`html { overflow-x: hidden }`, `.truncate { min-width: 0 }`) + regola tema scuro per i campi a fondo bianco (`input.bg-white:not([class*="dark:bg-"]) { color:#000; color-scheme:light }`).
- `tailwind.config.ts` -> Palette colori basata sugli istruttori.

## 📐 Regole di Impaginazione
- `istruzioni programmazione/REGOLE_MOBILE_LAYOUT.md` -> **Regole mobile obbligatorie** + procedura di misura con playwright-core.
- `istruzioni programmazione/REGOLE_VEICOLI_PATENTI.md` -> **Assegnazione veicoli/patenti**: priorità, memoria cliente, ordine categorie, divieto auto con patenti A.
- `.cursorrules` -> Sintesi operativa delle stesse regole + workflow standard del comando "pusha".

## 🧱 Componenti trasversali condivisi
- `/src/hooks/useAuth.ts` -> Sessione e ruolo utente. Contiene la **durata massima dell'accesso**: `SESSION_MAX_GIORNI = 15` (giorni di calendario) su `localStorage.auth_login_time`, controllata al mount, a ogni cambio di stato auth e ogni 60s; alla scadenza `signOut()` + redirect a `/login?scaduta=1`.
- `/src/components/Modal.tsx` -> Modale unico dell'app (portale, `z-[9999]`): chiudibile con ✕ `shrink-0`, titolo e padding adattivi su mobile. Ogni nuovo modale DEVE usarlo.
- `/src/components/forms/Select.tsx` -> Select custom condiviso.
- `/src/components/forms/OptionPicker.tsx` -> Base di **tutti** i picker (tasto + modale centrato): supporta singola e **multipla** selezione (`multiple` / `selectedValues` / `onToggle`), apertura controllata (`isOpen` / `onOpenChange`) e `hideTrigger`. Patente, veicolo e istruttori passano da qui.
- `/src/components/DraggableAppointment.tsx` -> Card del calendario: in riga mostra **orario, patente e veicolo** (targa preferita); in vista compressa resta la targa.
- Gruppo `‹ OGGI › | data` -> identico su `/` e `/calendar` (148x44 mobile, 192x40 desktop, centrato).

