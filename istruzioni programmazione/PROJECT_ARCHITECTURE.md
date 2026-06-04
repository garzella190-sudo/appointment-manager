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
- **Auto-selezione e Ricalcolo**: Quando si seleziona il cliente, l'istruttore, il tipo patente o il tipo di cambio, il sistema ricalcola e seleziona automaticamente il veicolo compatibile ottimale (Priorità: veicolo default istruttore -> primo veicolo compatibile libero per quello slot -> primo veicolo compatibile globale).
- **Auto-selezione Nuovo Cliente**: Quando viene registrato un nuovo cliente tramite il pulsante `+`, il sistema lo seleziona automaticamente compilando la barra di ricerca del modulo con il suo nome.
- **Privacy e Suddivisione Impegni ("Altro Impegno")**: Nella tendina di ricerca per gli impegni di ufficio, gli impegni vengono suddivisi in:
  - `---- Default ----`: contenente gli impegni definiti nelle impostazioni (identificati da `telefono: 'DEFAULT'`).
  - `---- [Nome Istruttore] ----`: contenente esclusivamente gli impegni personalizzati inseriti o utilizzati dall'istruttore attivo (identificati da `telefono` uguale al suo ID o presenti nei suoi appuntamenti in `impegnoInstructorMap`). Gli impegni personalizzati di altri istruttori rimangono nascosti.
- **Integrazioni**: Include trigger per l'invio di notifiche Email e WhatsApp.
- **Error Handling Notifiche**: Il sistema comunica chiaramente all'utente se l'invio dell'email ha avuto successo o se ci sono errori di configurazione (es. API Key mancante).

### `PhoneActions` & WhatsApp
La gestione delle comunicazioni avviene tramite il componente `PhoneActions` e `WhatsAppButton`.
- **Integrazione Gratuita**: Utilizza `https://wa.me/` per aprire chat dirette con messaggi pre-compilati.
- **Workflow Notifiche**: Al termine della creazione di un'appuntamento, se selezionato, il sistema apre automaticamente WhatsApp con la conferma per l'allievo.
- **Prefisso**: Il prefisso internazionale `39` viene gestito automaticamente.

### 🎓 Gestione Esami & Sedute
- **Automazione Impegni**: La creazione di una "Seduta d'Esame" permette di selezionare gli istruttori partecipanti (`istruttori_ids`) e un orario di inizio. Il sistema crea automaticamente un blocco di **3 ore** (Impegno di tipo 'Esame') per ogni istruttore coinvolto.
- **Sincronizzazione**: La cancellazione di una seduta d'esame comporta la rimozione automatica di tutti i blocchi d'impegno associati nei calendari degli istruttori.
- **Assegnazione Allievi & Tendina Alfabetica**: Gli allievi pronti per l'esame possono essere cercati tramite un menu a tendina filtrabile che si apre all'istante all'attivazione del campo di ricerca, visualizzando i candidati ordinati alfabeticamente. La sezione **Candidati** è posizionata in alto (subito dopo le Info Generali) per favorire la leggibilità e lo spazio della tendina. Al click su un allievo, questo viene aggiunto ed il menu si chiude in automatico.
- **Automazione Veicoli Impegnati**: 
  - **Auto**: All'aggiunta di un istruttore alla seduta, il sistema assegna automaticamente il suo veicolo predefinito (colonna `veicolo_id` della tabella `istruttori`) al database e lo associa all'impegno di guida a calendario.
  - **Moto**: All'aggiunta di un candidato con patente moto ('AM', 'A1', 'A2', 'A'), il sistema assegna automaticamente una moto idonea leggendo i veicoli abilitati per quella patente (`patenti.veicoli_abilitati`) con fallback su una moto generica se non specificato.
- **Indicatori Visivi**: Le schede delle guide in Agenda e Calendario mostrano un'icona `GraduationCap` dinamica: **Verde** per chi ha l'esame fissato, **Grigio Chiaro** per chi è solo segnato come "Pronto".
- **Integrazione Viste**: Sia la vista **Calendario** sia la vista **Agenda** (home page) intercettano correttamente gli appuntamenti associati a una seduta d'esame (`sessione_esame_id`) aprendo direttamente il modale di gestione dell'esame (`ExamSessionModal`) anziché i dettagli generali dell'appuntamento.
- **Layout Modale**: Il tasto "Modifica Dettagli Seduta" è collocato in basso a tutto come azione principale di chiusura.

### 👤 Filtro Istruttori & Multi-selezione
- **Logica**: L'agenda permette di filtrare gli istruttori tramite pulsanti toggle nel pannello "People".
- **Auto-Switch Vista**: 
  - Se vengono selezionati **2 o più** istruttori o viene premuto il pulsante **"Tutti"**, il sistema passa automaticamente alla **vista in colonna** (Resource View) per prevenire qualsiasi sovrapposizione.
  - Con **esattamente 1** istruttore selezionato, il sistema passa automaticamente alla **vista settimana**.
- **Affiancamento Orizzontale Overlap**: Se appuntamenti sovrapposti condividono lo **stesso identico orario di inizio**, il sistema li affianca orizzontalmente in colonne adiacenti della stessa larghezza (`flex-1 min-w-0`), ridimensionando automaticamente i caratteri ed i paddings delle schede in modo compatto per salvaguardare la leggibilità.
- **Auto-Filtro Intelligente & Matching**: Al primo accesso (caricamento del calendario), se l'utente è un amministratore o segretario privo di `istruttore_id` esplicito nei metadati, il sistema esegue un tracciamento predittivo per Nome/Cognome/Email trovando la corrispondenza con la lista istruttori (es. Manuele Garzella) e imposta automaticamente il filtro su di esso per evitare il disordine iniziale della griglia cumulativa.
- **Azione Pulsante People ("Torna a Settimana")**: Cliccando su "Torna a Settimana" dalla vista risorse, il calendario rileva l'istruttore loggato tramite auto-filtro, seleziona esclusivamente quell'utente e passa alla vista settimana priva di disordine.
- **Persistenza**: Le preferenze di selezione vengono salvate nel `localStorage`.

### 🔒 Sicurezza & Sessioni (Forzatura Logout)
- **Massima Durata Sessione (3h 30m)**: Il sistema limita la sessione dell'utente a 3 ore e 30 minuti totali per forzare il reinserimento della password e assicurare un hard refresh costante del codice JavaScript lato client.
- **Polling di Monitoraggio**: Un timer attivo in background effettua un controllo ogni 60 secondi confrontando il timestamp di login salvato in locale con il tempo attuale.
- **Espulsione & Hard Reload**: Superato il tempo massimo, il sistema cancella le credenziali locali, effettua il `signOut` su Supabase e forza il reindirizzamento tramite `window.location.href = '/login'`, eliminando ogni traccia di vecchi pacchetti JS e costringendo a caricare la versione più aggiornata.

### 📧 Onboarding Staff (Welcome Email)
- **Logica**: Il sistema prevede un invio massivo di email di benvenuto (`/api/cron/welcome`) per configurare lo staff al primo accesso.
- **Contenuto**: Include credenziali predefinite, link di accesso diretto e istruzioni per l'installazione della PWA su iOS e Android.
- **Reportistica**: Al termine del ciclo di invio, il sistema invia un report dettagliato di esecuzione all'amministratore.

### ⏰ Automazione Promemoria (Cron) & E-mail
- **Logica**: Il cron job giornaliero (`/api/cron/reminders`) invia promemoria per le guide del **giorno successivo** (Domani), garantendo un preavviso adeguato.
- **Schedule**: Eseguito ogni mattina alle 05:30 UTC tramite Vercel Cron.
- **Modelli E-mail Personalizzati**:
  - **Conferma Prenotazione**: E-mail inviata alla creazione con testo *"La guida per il giorno gg/mm/yyyy alle ore hh:mm è stata prenotata correttamente"*.
  - **Promemoria 24h**: E-mail di promemoria con oggetto *"Promemoria Guida Prenotata"* e testo *"Ricordati la guida per il giorno gg/mm/yyyy alle ore hh:mm"*.
  - Entrambe le e-mail mantengono il layout premium, l'allegato `.ics` e includono in calce le note fisse di disdetta (*"NB: le guide vanno disdette 24h prima, pena addebito dell'importo"* e *"Per disdire le guide chiama in autoscuola oppure contatta il tuo istruttore"*).

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
- **Gestione Sovrapposizioni (z-index)**: Le righe degli slot orari del calendario hanno un `zIndex` decrescente rispetto all'ora (`zIndex = timeSlots.length - index`). Questo assicura che le schede degli appuntamenti (che si sviluppano verticalmente verso il basso) vengano visualizzate *sopra* gli slot successivi, garantendo la completa cliccabilità di tutta l'area colorata ed evitando che gli slot vuoti catturino erroneamente i click.
- **Eventi di Click su Elementi Draggable**: L'apertura dei dettagli avviene tramite l'evento `onClick` nativo con `stopPropagation()`. Grazie al sensore `SmartPointerSensor` con vincolo di attivazione a 8px, dnd-kit distingue e previene automaticamente i click accidentali durante il trascinamento su desktop, disattivando il drag & drop su tutti i touch-screen mobili per garantire una navigazione fluida.
- **Colori**:
  - Background neutri (`bg-[#F4F4F4]` in light mode).
  - Accenti di colore basati sugli istruttori.
- **Input Guidelines**: Mai usare "testo nudo" per visualizzare dati nei dettagli; usare box grigio chiaro (`bg-zinc-100` o f4f4f4) per racchiudere ogni campo valore.

---

## 📝 WORKFLOW PER GLI AGENTI
1. **Analisi**: Prima di ogni modifica, leggi questo file.
2. **Coerenza**: Se modifichi un campo nel DB, aggiorna `database.types.ts` e di conseguenza i Form relativi.
3. **Mirroring**: Il design dei modali di dettaglio (`DetailsModal`) deve sempre rispecchiare quello di creazione (`NewAppointmentModal`).
