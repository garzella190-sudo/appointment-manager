# 🗺️ Project Architecture & rules - Appointment Manager

Questo documento funge da **Mappa e Regolamento** per lo sviluppo dell'applicazione "Appointment Manager". Ogni nuova modifica o aggiunta deve rispettare rigorosamente queste linee guida.

---

## 📂 STRUTTURA CARTELLE
L'applicazione segue la struttura di **Next.js (App Router)** con una divisione chiara tra logica, interfaccia e azioni server.

```text
src/
├── actions/        # Server Actions (CRUD per appuntamenti, clienti, istruttori, veicoli)
├── app/            # Main App Router (pagine, layout e API)
│   ├── calendar/   # Vista Calendario settimanale/giornaliera
│   ├── clienti/    # Schede dettaglio e storico clienti
│   ├── gestione/   # Pannello admin (Istruttori, Veicoli, Patenti)
│   └── login/      # Flusso di autenticazione
├── components/     # Componenti UI riutilizzabili
│   ├── forms/      # Form universali (AppointmentForm, ClienteForm, etc.)
│   ├── modals/     # Popup e Modali (DetailsModal, NewAppointmentModal)
│   ├── calendar/   # Sottocomponenti specifici per la griglia calendario
│   └── BottomNav.tsx # Navigazione principale unificata (Profilo + Nav + Logout)
├── hooks/          # Custom hooks (es. useAvailability, useAuth, useToast)
├── lib/            # Configurazioni core (Supabase client, Database Types)
├── types/          # Definizioni TypeScript extra
└── utils/          # Funzioni helper e formattatori (date, valuta, whatsapp)
```

---

## 🗄️ IL DATABASE (LA REGOLA D'ORO)
Tutte le interazioni con il database Supabase devono utilizzare esclusivamente le tabelle in **italiano**. È vietato creare o utilizzare tabelle in inglese (es. *appointments*, *trainers*).

**Tabelle valide:**
- `appuntamenti`: Cuore del sistema. Contiene FK verso clienti, istruttori e veicoli.
- `clienti`: Database anagrafico degli allievi.
- `istruttori`: Gestione dello staff e delle loro preferenze (colore, veicolo default).
- `veicoli`: Parco macchine/moto con scadenze revisioni e tipi patente.
- `patenti`: Elenco categorie (A, B, C...) con durate guida di default.

> [!IMPORTANT]
> Non creare mai nuovi nomi di colonne senza prima verificare `src/lib/database.types.ts`. La coerenza linguistica è strutturale.

---

## 🧩 COMPONENTI CORE

### `AppointmentForm` (SSOT per i Dati)
È il modulo universale per la **Creazione** e **Modifica** delle guide.
- **Logica Durata**: Gestisce step predefiniti (30, 60 min) o "Personalizzato".
- **Auto-selezione**: Quando si sceglie un istruttore, il sistema seleziona automaticamente il suo veicolo di default (se compatibile con la patente del cliente).
- **Integrazioni**: Include trigger per l'invio di notifiche WhatsApp.

### `PhoneActions` & WhatsApp
La gestione delle comunicazioni avviene tramite il componente `PhoneActions`.
- Utilizza `https://wa.me/` per aprire chat dirette.
- Il prefisso internazionale `39` deve essere gestito automaticamente se mancante.

---

## 🎨 STILE E UI (ULTRA-COMPACT DESIGN)
L'identità visiva è "Premium, Clean & Dynamic" con un focus estremo sul recupero dello spazio verticale.

- **Framework**: Tailwind CSS (Utility-first).
- **Single Nav Bar**: La `TopNav` è stata eliminata. Tutte le funzioni (Profilo Utente, Navigazione, Logout) sono integrate in una `BottomNav` unificata.
- **Geometrie**:
  - **Cards & Inputs**: `rounded-[16px]` o `rounded-xl`.
  - **Modali**: `rounded-[32px]` per angoli molto profondi ed eleganti.
- **Dettagli Ultra-Compact**:
  - **Top Nav**: Assente. Il contenuto inizia a `pt-0`.
  - **Calendario**: Cerchi date `w-7 h-7`, titoli minimali, granularità variabile (15/30/60 min).
- **Colori**:
  - Background neutri (`bg-[#F4F4F4]` in light mode).
  - Accenti di colore basati sugli istruttori.
- **Input Guidelines**: Mai usare "testo nudo" per visualizzare dati nei dettagli; usare box grigio chiaro (`bg-zinc-100` o f4f4f4) per racchiudere ogni campo valore.

---

## 📝 WORKFLOW PER GLI AGENTI
1. **Analisi**: Prima di ogni modifica, leggi questo file.
2. **Coerenza**: Se modifichi un campo nel DB, aggiorna `database.types.ts` e di conseguenza i Form relativi.
3. **Mirroring**: Il design dei modali di dettaglio (`DetailsModal`) deve sempre rispecchiare quello di creazione (`NewAppointmentModal`).
