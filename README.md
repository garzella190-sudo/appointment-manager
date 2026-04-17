# Appointment Manager - Agenda Guide

Un'applicazione Next.js moderna per la gestione di appuntamenti, guide e parco veicoli, ottimizzata per un utilizzo "Mobile-First" ed ultra-compatto.

## 🚀 Funzionalità Principali
- **Agenda Giornaliera**: Vista lista con scroll automatico all'orario attuale.
- **Calendario Interattivo**: Griglia multi-giorno (1, 3, 5, 7 giorni) con granularità variabile (15, 30, 60 minuti).
- **Gestione Master**: Anagrafica clienti, istruttori e veicoli con controllo scadenze.
- **PWA Ready**: Installabile su dispositivi mobili con supporto offline di base.
- **Notifiche Smart**: Invio email di conferma tramite Resend con allegato calendario (ICS).
- **Automazione Promemoria**: Cron job giornaliero che invia promemoria per le guide del giorno successivo.
- **WhatsApp Integration**: Invio gratuito di conferme e promemoria con messaggi pre-compilati (Click-to-Chat).
- **Automazione Esami**: Creazione sedute esame con generazione automatica di blocchi d'impegno e **indicatori visivi dinamici** sulle guide.

## 🎨 Design System
- **Ultra-Compact UI**: Navigazione unificata in una singola barra inferiore (BottomNav) che integra il profilo utente e il logout.
- **Massimizzazione Spazio**: Rimozione di barre superiori fisse e logica di stretch-up per sfruttare ogni pixel verticale.
- **Premium Look**: Colori armoniosi basati sugli istruttori, geometrie arrotondate (32px) e micro-animazioni.

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router).
- **Database/Auth**: Supabase.
- **Stile**: Tailwind CSS.
- **Componenti**: Lucide React, Date-fns, DND-Kit.

## 📦 Installazione
1. Clona il repository.
2. `npm install`
3. Configura le variabili d'ambiente in `.env.local` per Supabase.
4. `npm run dev`
