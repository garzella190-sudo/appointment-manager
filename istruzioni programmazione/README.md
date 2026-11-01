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
- **Automazione Esami**: Creazione sedute esame con gestione istruttori (`istruttori_ids`), generazione automatica di blocchi d'impegno e indicatori visivi dinamici sulle guide.
- **Identità Visiva**: PWA Icon personalizzata (volante/birillo rosso e arancio su sfondo agenda) ottimizzata per iOS e Android.

## 🎨 Design System
- **Ultra-Compact UI**: Navigazione unificata in una singola barra inferiore (BottomNav) che integra il profilo utente e il logout.
- **Massimizzazione Spazio**: Rimozione di barre superiori fisse e logica di stretch-up per sfruttare ogni pixel verticale.
- **Premium Look**: Colori armoniosi basati sugli istruttori, geometrie arrotondate (32px) e micro-animazioni.

## 🛠️ Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack).
- **Database/Auth**: Supabase.
- **Stile**: Tailwind CSS.
- **Componenti**: Lucide React, Date-fns, DND-Kit.

## 📐 Regole di Impaginazione
Le regole di impaginazione responsiva e la procedura di misura sono in
[`REGOLE_MOBILE_LAYOUT.md`](./REGOLE_MOBILE_LAYOUT.md). In sintesi:
- Griglie a colonna singola sempre `grid grid-cols-1` (mai `grid gap-X`).
- `truncate` sempre con `min-w-0`.
- Touch target minimo 32px (36-40 su mobile).
- Wrapper centrati in `absolute` sempre con `pointer-events-none`.
- Verifica strumentata a 320/360/390/412/430px prima di ogni commit.

## 🚗 Assegnazione Veicoli
Le regole di scelta del mezzo sono in
[`REGOLE_VEICOLI_PATENTI.md`](./REGOLE_VEICOLI_PATENTI.md). In sintesi:
- Fonte di verità: `patenti.veicoli_abilitati`.
- Prima la memoria del cliente, poi la patente richiesta, poi il default istruttore.
- Patenti A: mai auto. Nessun appuntamento senza veicolo.
- Selettore veicolo = modale `PatentePicker`.


## 📦 Installazione
1. Clona il repository.
2. `npm install`
3. Configura le variabili d'ambiente in `.env.local` per Supabase.
4. `npm run dev`
