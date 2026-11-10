# Regole Assegnazione Veicoli ↔ Patenti

Come il gestionale sceglie il veicolo di una guida. Queste regole sono implementate in
`src/components/forms/AppointmentForm.tsx` e vanno rispettate da qualsiasi nuovo flusso
che assegni un mezzo a un appuntamento.

---

## Fonte di verità: `patenti.veicoli_abilitati`

L'elenco dei mezzi abilitati per ogni patente si configura in **Gestione → Patenti**
(`veicoli_abilitati`, array di `veicoli.id`, con l'ordine che determina la priorità).

Situazione attuale:

| Patente | Veicoli abilitati |
|---|---|
| AM | Buster `[AM - Auto]`, Mash `[AM - Man]` |
| A1 | Liberty `[A1 - Auto]`, Yamaha 125 `[A1 - Man]` |
| A2 | Beverly `[A2 - Auto]`, Suzuki 500 `[A2 - Man]` |
| A | Suzuki SV 650 `[A - Man]` |
| B | Fiat Panda 2007, Polo Valter, Polo Daniele, **Mercedes Mosi `[B - Auto]`** |

> ⚠️ Un veicolo **non** presente in `veicoli_abilitati` non viene mai assegnato automaticamente.
> Ogni nuovo mezzo va quindi collegato alla patente dalla schermata Gestione.

---

## Ordine delle regole (in `handleClienteChange`)

1. **Memoria del cliente** — se l'ultimo appuntamento del cliente ha un veicolo ancora valido,
   si riusa quello. È la scelta esplicita fatta dall'istruttore.
2. **Patente richiesta nella scheda cliente** — senza storico valido si applica la mappa
   `veicoli_abilitati` + il cambio richiesto (`preferenza_cambio`, dove *Automatico = cod. 78*).
3. **Default dell'istruttore** — se compatibile, altrimenti il primo mezzo compatibile e libero.

La memoria sopravvive anche se l'appuntamento più recente è senza veicolo: si guarda
indietro fino all'ultimo mezzo assegnato (ultime 12 guide).

### Validità dello storico (`isStoricoValido`)

| Caso | Esito |
|---|---|
| Moto usata da patente A/A1/A2/AM, con lo stesso tipo di cambio | ✅ riusata (anche se di categoria diversa, es. Yamaha 125 `A1` per una `A` manuale) |
| Moto di categoria **superiore** alla patente (es. Beverly `A2` per una `A1`) | ❌ scartata |
| Auto usata da una patente A (o moto da una patente B) | ❌ scartata |
| Cambio diverso da quello richiesto (manuale vs automatico) | ❌ scartata |

Copertura legale delle patenti moto (`MOTO_COVERAGE`):

```
AM → AM
A1 → AM, A1
A2 → AM, A1, A2
A  → AM, A1, A2, A
```

---

## Regola dura moto/auto

`isVehicleCompatible()` rifiuta **sempre** l'accoppiata patente A ↔ auto (e patente B ↔ moto),
anche se `veicoli_abilitati` fosse configurato male. Se cliente richiede una patente A,
in nessuna lista compaiono auto.

---

## Nessun appuntamento senza veicolo

- L'opzione "Senza veicolo" **non** esiste più nella tendina veicolo.
- `handleSubmit` blocca il salvataggio: *"Assegna un veicolo: non è possibile salvare un
  appuntamento senza veicolo."*
- Eccezione: gli **impegni di ufficio** (`is_impegno`), che per definizione non hanno veicolo.

---

## Presentazione della lista

- Ordine: **AM → A1 → A2 → A** e, dentro la stessa categoria, prima le **automatiche** e poi
  le meccaniche (`MOTO_RANK` + `sortMotoByCategory`).
- Etichette: `Nome [AM - Auto]` per le moto, `Nome (TARGA)` per le auto (`veicoloLabel`).
- I veicoli si scelgono in un **modale in primo piano**; vedi sotto.

---

## TIPO CAMBIO (solo moto) — deve essere realistico

Il selettore `Manuale / Automatico` non è decorativo: **determina davvero i mezzi possibili**.

- La lista moto mostrata nel picker è **filtrata dal cambio scelto**: con `Automatico` si vedono
  solo moto automatiche (Buster, Liberty, Beverly), con `Manuale` solo le meccaniche
  (Mash, Yamaha 125, Suzuki 500, Suzuki SV 650).
- Cambiando il cambio, la moto viene **riassegnata** al primo mezzo libero compatibile; tornando
  indietro torna la moto adatta (verificato: SV 650 → Beverly → Mash).
- Scegliendo una moto dal picker il selettore **si allinea al mezzo reale**
  (`veicolo.cambio_manuale`): mai "Manuale" con una moto automatica.
- Se non c'è nessuna moto libera con quel cambio compare l'avviso
  *"Nessuna moto automatica/manuale libera in questo orario"* e il campo resta vuoto
  (meglio che assegnare un mezzo occupato e creare un conflitto).
- **Aprendo un appuntamento esistente** il cambio va ricavato dal **mezzo usato**
  (`veicolo.cambio_manuale`), non da `appuntamenti.cambio`: quella colonna **non esiste**
  (campi reali: `cliente_id, istruttore_id, veicolo_id, data, durata, stato, importo, note,
  inizio, fine, data_solo, patente_id, sessione_esame_id, send_email, send_whatsapp, …`).
  Il fallback è `clienti.preferenza_cambio`, poi `manuale`. Senza questo passaggio il dettaglio
  mostrava "Manuale" accanto a una moto automatica (es. `Buster [AM - Auto]`).
- Per le **moto** la compatibilità usa la **copertura legale** (`MOTO_COVERAGE`): una A può
  guidare AM/A1/A2/A dentro il cambio richiesto — **non** la lista `veicoli_abilitati`, che è
  pensata per le auto. Senza questa distinzione il cambio su "Automatico" non trovava mezzi.

---

## Selettori (patente e veicolo)

Architettura a tre livelli, **nessun dropdown** e nessuna duplicazione:

| Componente | Ruolo |
|---|---|
| `forms/OptionPicker.tsx` | Base condivisa: tasto + modale **centrato** con ricerca, colori, chiusura con Esc/backdrop. Supporta anche selezione **multipla** (`multiple`, `selectedValues`, `onToggle`, `confirmLabel`) e apertura controllata (`isOpen` / `onOpenChange` / `hideTrigger`) — usata dal picker istruttori in Agenda. Le opzioni accettano `info` (testo a destra, es. "Occupato") e `disabled` (voce non cliccabile e attenuata) |
| `forms/PatentePicker.tsx` | Wrapper per la patente (titolo "Patente Richiesta", icona badge, `Cerca patente...`) |
| `forms/VehiclePicker.tsx` | Wrapper per il veicolo (titolo "Veicolo", icona auto, `Cerca veicolo...`) |
| `forms/IstruttorePicker.tsx` | Wrapper per l'istruttore (titolo "Istruttore", icona utente, `Cerca istruttore...`); gli istruttori già impegnati arrivano `disabled` + `info: 'Occupato'` |

Regole:
- In `AppointmentForm` i campi **PATENTE**, **VEICOLO** e **ISTRUTTORE** usano questi modali, mai il `<Select>` a tendina.
- Per un nuovo selettore sul modello "lista di opzioni con ricerca" → usare `OptionPicker`, non copiare il markup.
  Se serve scelta multipla o apertura da un tasto esterno, usare le prop esistenti: **non** creare un secondo modale.

### Elenco patenti nei selettori — usare `caricaPatentiVisibili()`

**Mai** filtrare con `.eq('nascosta', false)` nella query: la colonna `nascosta` non è
nello schema versionato (`supabase/schema.sql`), è stata aggiunta a mano sul database e
se manca o è `NULL` il confronto SQL `nascosta = false` **non trova nessuna riga** → il
selettore patente resta vuoto (bug reale del "nuovo cliente senza patenti").
Regola: si scaricano tutte le patenti e si scarta in JS solo `nascosta === true`:

```ts
import { caricaPatentiVisibili, ordinaPatenti } from '@/lib/patenti';
const patenti = await caricaPatentiVisibili(supabase); // attive
const ordinate = ordinaPatenti(patenti);               // B per prima, poi A-Z
```

Usata da: `app/clienti`, `app/clienti/[id]`, `forms/AppointmentForm`, `forms/IstruttoreForm`,
`forms/VeicoloForm`, `forms/SchedaClienteForm`. La scheda **Gestione → Patenti** invece deve
vedere anche le nascoste: lì la query resta senza filtro.

### La patente richiesta è OBBLIGATORIA

- `SchedaClienteForm` (nuovo cliente e modifica) non salva senza patente: mostra l'errore
  sul campo (`errorePatente`), un bordo rosso e un toast.
- Anche la modifica inline in `app/clienti/[id]` blocca il salvataggio.
- Lato server `createClienteAction` / `updateClienteAction` rifiutano
  `patente_richiesta_id` nullo (l'offline sync registra il caso come conflitto).
- Se non ci sono patenti attive, la scheda cliente lo dice esplicitamente
  ("configurale da Gestione → Patenti") invece di lasciare un campo vuoto inspiegabile.

### Visibilità del veicolo fuori dal form

Il mezzo assegnato è un'informazione operativa: deve essere visibile **senza aprire** l'appuntamento.
- **Agenda**: chip `🚗 Nome (TARGA)` nella card, accanto al chip patente.
- **Calendario**: nella riga orario del blocco (`09:30 — 10:30 · A · 🚗 AG723AG`); nelle viste
  compresse resta la targa, che è il dato più corto e univoco.
- Etichetta: targa se il valore la contiene (`Nome (TARGA)`), altrimenti il nome intero;
  `''`/`Nessuno` ⇒ nessun chip.

---

## Note di business

- Il **99,99%** delle patenti B rilasciate è manuale: il default per la B resta il cambio manuale.
- Per la **B automatica** esiste solo la *Mercedes Mosi* (`MOSI001`).
- Per la **A automatica** non esiste alcun mezzo in flotta: è corretto che non venga assegnato
  nulla (e che il salvataggio chieda di scegliere un veicolo).
