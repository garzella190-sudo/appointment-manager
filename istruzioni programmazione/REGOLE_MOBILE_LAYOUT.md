# Regole Mobile Layout — Appointment Manager

Regole **obbligatorie** per la UI. Derivano da bug reali trovati e misurati in produzione
(card larga 428px dentro uno schermo da 320px, tasti non cliccabili, target da 20px).
Ogni regola è verificabile con la procedura in fondo.

---

## 1. Griglie a colonna singola → sempre `grid-cols-1`

```diff
- <div className="grid gap-3">        {/* SBAGLIATO */}
+ <div className="grid grid-cols-1 gap-3">
```

**Perché:** `grid` senza template crea una colonna implicita `auto`, dimensionata al
**max-content** del contenuto. Con chip o testi `nowrap` la colonna cresce oltre lo schermo
(misurati 428/446px su display da 320px) e `overflow-x: hidden` nasconde il problema.
`grid-cols-1` = `minmax(0,1fr)` → la colonna si adatta allo spazio disponibile.

Vale per **ogni** lista di card: agenda, clienti, esami, gestione, interne ai modali.

---

## 2. `truncate` richiede `min-width: 0`

```diff
- <span className="truncate">{testo}</span>
+ <span className="block min-w-0 truncate">{testo}</span>
```

`truncate` impone `white-space: nowrap`: senza `min-width: 0` l'elemento dentro flex/grid
non può restringersi e il troncamento non avviene mai.
In `src/app/globals.css` esiste già la regola di sicurezza globale:

```css
.truncate { min-width: 0; }
```

---

## 3. Touch target minimo: 32px (36–40px consigliato su mobile)

| Contesto | Minimo |
|---|---|
| Tasto icona generico | 32 × 32 |
| Tasti in barra/header mobile | 36 × 36 |
| Azione primaria (Conferma, Nuovo) | 40–48 in altezza |

Da evitare: `p-1.5` con icona 16px (= 28px), `py-1` (= 22px), `h-7` (= 28px).
Tecnica utile: **non** aumentare solo il padding orizzontale; usa `h-9 w-8` / `h-10 w-10`
per avere altezza sufficiente anche in gruppi compatti.

Le **celle della griglia calendario** sono l'unica eccezione ammessa (densità della vista).

---

## 4. Contenitori centrati in `absolute` → `pointer-events-none`

```diff
- <div className="absolute left-1/2 -translate-x-1/2 w-full">   {/* copre i tasti sotto */}
+ <div className="absolute left-1/2 -translate-x-1/2 w-full pointer-events-none">
+   <div className="pointer-events-auto">…tasti…</div>
```

Un wrapper centrato a larghezza piena è **sopra** gli altri elementi nel DOM: intercetta i
click pur sembrando vuoto. Sintomo: i tasti sono visibili ma "non rispondono".
Mettere `pointer-events-auto` solo sul contenuto reale.

---

## 5. Mai nascondere su mobile azioni necessarie

```diff
- className="hidden sm:flex …"     {/* il tasto sparisce sotto 640px */}
+ className="flex …"
```

Prima di aggiungere `hidden sm:*`, chiedersi: *su telefono quell'azione è raggiungibile in
un altro modo?* Se no, deve restare visibile (eventualmente compattata).

---

## 6. Header: 1 riga su desktop, 2 su mobile

- Desktop (≥1024px): titolo + data + controlli su **una sola riga** (~54–70px). L'header a
  colonna spreca ~80–150px di altezza utile alla tabella.
- Mobile: riga 1 = titolo, data e azioni; riga 2 = gruppo di navigazione **centrato**.
- Il blocco sinistro va limitato (`lg:max-w-[236px]`) quando accanto c'è un elemento
  centrato assoluto, altrimenti il testo finisce sotto il gruppo centrato.

---

## 6-bis. Calendario — vista più istruttori

- I giorni sono **affiancati in orizzontale**: fascia giorni in alto, poi gli istruttori come
  sotto-colonne dentro ogni giorno.
- **Mai comprimere le colonne**: larghezza minima **132px per istruttore** (110px per giorno
  in vista settimana). Sotto quella soglia la griglia **scorre in orizzontale** invece di
  rimpicciolire le card — un contenitore unico contiene header e righe, così scorrono insieme.
- Su **mobile massimo 3 istruttori**: la selezione eccedente va rifiutata con messaggio;
  il tasto "Tutti" seleziona i primi 3.
- **Separatore verticale marcato** (`border-l-2 border-l-zinc-400 dark:border-l-zinc-600`)
  all'inizio di ogni gruppo-giorno, applicato in modo allineato su fascia giorni, fascia
  istruttori e ogni riga oraria (via `className` di `DroppableCell`).
- Le preferenze utente (`calendar_viewDays`) **non** vanno sovrascritte al `resize`:
  il default legato allo schermo si applica solo al primo avvio.

---

## 6-ter. Agenda — raggruppamento per istruttore e dati sempre visibili

- Il tasto **people** apre un picker **multi-istruttore** (stesso `OptionPicker` in modalità
  `multiple`): si spuntano più nomi, il modale resta aperto e mostra `Conferma (n)`.
  Nessuna selezione = tutti gli istruttori. Il tasto porta un **badge col conteggio** attivo.
- Le guide sono **raggruppate per istruttore**: intestazione con pallino del colore, nome in
  maiuscolo, conteggio e linea separatrice; dentro il gruppo **ordine cronologico**
  (`appointment_time`), gruppi in ordine alfabetico italiano, non assegnate nel gruppo
  "Non assegnato".
- La griglia delle card resta `grid grid-cols-1` **dentro ogni gruppo**: il raggruppamento non
  deve reintrodurre righe orizzontali o colonne implicite (regola 1).
- Con **più istruttori i gruppi sono AFFIANCATI IN ORIZZONTALE, mai impilati**:

```jsx
<div className={gruppi.length > 1
  ? "flex items-start gap-3 overflow-x-auto pb-3 snap-x"
  : "space-y-5"}>
  <div className={gruppi.length > 1 ? "flex-1 min-w-[86vw] sm:min-w-[320px] snap-start" : ""}>
```

  - Larghezza minima colonna **86vw su mobile** (la colonna successiva si intravede) e
    **320px da `sm`**; il contenitore scorre in orizzontale invece di comprimere le card.
  - `min-w` sul figlio è obbligatorio: con solo `flex-1` la colonna si restringe a 0 invece di
    attivare lo scroll.
  - **MAI mettere `.scroll-container` sul contenitore orizzontale**: quella classe imposta
    `overflow-x: hidden` e uccide lo scorrimento (su mobile si vede solo la prima colonna).
    Usare `overflow-x-auto` + `snap-x snap-mandatory` + `style={{ WebkitOverflowScrolling: 'touch' }}`.
  - Verifica: tutti i gruppi con la **stessa `y`**, `getComputedStyle(cont).overflowX === 'auto'`,
    `scrollWidth > clientWidth`, `cont.scrollLeft = 400` deve restituire `> 0`, e uno **swipe touch
    reale** (CDP `Input.dispatchTouchEvent`) deve spostare `scrollLeft`. Sulla pagina
    `document.scrollWidth === clientWidth` (nessuno sforamento).

**Regola dei dettagli minimi (obbligatoria):** senza aprire l'appuntamento devono essere
leggibili **orario, patente e veicolo in uso**.

| Dove | Come |
|---|---|
| Agenda | chip in card: `ORARIO` + `PAT. X` + `🚗 Nome (TARGA)` |
| Calendario, vista normale | riga 2 del blocco: `09:30 — 10:30 · A · 🚗 AG723AG` |
| Calendario, vista compressa (più colonne) | resta l'**orario** e la **targa** |

Il veicolo si stampa con la **targa** se presente (`Liberty (ES59409)` → `ES59409`), altrimenti
col nome; i valori vuoti o `Nessuno` non producono alcun chip.

### 6-ter.1 Ricerca in agenda = tutto il calendario

Il tasto cerca **non** filtra il giorno visualizzato: cerca in **tutte** le guide e divide i
risultati in **Guide future** e **Guide svolte** (chiave di confronto `yyyy-MM-dd HH:mm`).

- Il filtro istruttore **non** si applica alla ricerca: si cerca il cliente, chiunque lo segua.
- Quattro filtri con i rispettivi conteggi: `Tutte / Future / Svolte / Annullate`
  (`grid grid-cols-2` su mobile, `flex` da `sm`, così le 4 etichette non si schiacciano).
- **Le ore NON vanno scritte sui tasti**: su 320–390px la seconda riga rendeva il tasto illeggibile.
  Il tasto resta a **una sola riga** (`h-9`, `text-[10px]`, `whitespace-nowrap`, solo `ETICHETTA + n`).
  Le ore stanno nel **riepilogo sotto i filtri** (`Ore totali` / `Effettuate` / `Annullate`, 3 box
  `grid-cols-3`) e nelle **intestazioni di sezione** (`GUIDE SVOLTE 24 · 17h 45m`).
  Verifica a 390px: tasti alti **36px**, nessun `scrollWidth > clientWidth`, pagina senza sforamento.
- **Le guide annullate hanno una sezione propria** (`stato === 'annullato'`), in fondo, con pallino
  e titolo **rossi** e la chip `ANNULLATA` sulla card. Sono **escluse** da future e svolte, così i
  conteggi non si sommano due volte (verificato: 27 totali = 1 futura + 24 svolte + 2 annullate).
- Ogni riga risultato mostra sempre **data, ora, cliente, istruttore, patente e veicolo**.
- **Paginazione obbligatoria**: Supabase/PostgREST restituisce max **1000 righe** per richiesta.
  Senza `.range()` ciclico i risultati più recenti non comparirebbero mai (con 1166 guide il
  cliente cercato dava "0 risultati"). Il fetch completo si fa **una volta** e resta in cache
  finché non arriva l'evento `appointments-updated`.

---

## 7. Stessi controlli = stesso gruppo tra pagine

Il gruppo `‹ OGGI › | 📅` deve essere **identico** su Agenda e Calendario: stessi tasti,
stesso ordine, stesse misure, stessa posizione (centrato).

| | Mobile | Desktop |
|---|---|---|
| Gruppo | 148 × 44 | 192 × 40 |
| Tasti | `32×36 · 40×36 · 32×36 · 32×36` | `32×32 · 57×32 · 32×32 · 32×32` |

Non reinventare il controllo su ogni pagina: copiare le classi.

### 7.1 In Calendario le frecce scorrono di TANTI giorni quanti ne vedi

Il passo di navigazione **non è 1 giorno fisso**: è il numero di giorni mostrati (`viewDays`).

```ts
const passoGiorni = effectiveViewDays > 0 ? effectiveViewDays : 1;
const navigateWeek = (d: 1 | -1) => { const n = new Date(currentDate); n.setDate(n.getDate() + d * passoGiorni); setCurrentDate(n); };
```

| Vista | Passo `‹` / `›` | `title` del tasto |
|---|---|---|
| 1 giorno | 1 | "Giorno precedente/successivo" |
| 3 giorni | **3** | "3 giorni precedenti/successivi" |
| 5 giorni | **5** | "5 giorni precedenti/successivi" |
| 7 giorni | **7** | "7 giorni precedenti/successivi" |

Vale sia per `navigateWeek` (tasti e modulo "Visualizzazione") sia per i listener
`calendar-prev` / `calendar-next` della fullscreen. `passoGiorni` va definito **sopra** gli
effetti che lo usano (altrimenti errore di inizializzazione nel render).
Misura verificata (cambio data in `localStorage.calendar_currentDate`):
3G `04→01→04→07 nov`, 5G `04→30 ott→04→09 nov`, 7G `04→28 ott→04→11 nov`.

---

## 7-bis. Modali e picker sempre **centrati**

I selettori (patente, veicolo, ecc.) e i modali devono stare **al centro dello schermo**,
mai ancorati in basso come un vecchio bottom-sheet/dropdown:

```diff
- <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-4">
+ <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
```

Verifica: il centro della card deve coincidere con il centro del viewport (scarto 0px su X e Y).

---

## 7-ter. Tema scuro: campo bianco = caratteri neri

`body` dichiara `text-zinc-900 dark:text-zinc-100`: **tutti i controlli ereditano il colore del
testo**. Un input con `bg-white` e senza variante `dark:bg-*` resta bianco anche in tema scuro,
quindi il testo digitato diventava **bianco su bianco** (bug reale: campo email nel
"Nuovo Appuntamento", illeggibile).

```diff
- <input className="w-full bg-white border border-amber-200 …" />
+ <input className="w-full bg-white text-black caret-black placeholder:text-zinc-500 … [color-scheme:light]" />
```

- `text-black` + `caret-black` → testo e cursore sempre leggibili.
- `[color-scheme:light]` → anche il rendering nativo (autofill, selezione) resta chiaro.
- Se il campo invece deve diventare scuro, serve `dark:bg-*` **e** testo ereditato: non forzare il nero.

Rete di sicurezza globale in `globals.css` (non sostituisce la classe esplicita):

```css
input.bg-white:not([class*="dark:bg-"]), textarea.bg-white:not([class*="dark:bg-"]) {
  color: #000;
  color-scheme: light;
}
```

Campi già a posto perché hanno `dark:bg-*`: ricerca clienti/agenda/gestione, candidati esami.

**Riquadri colorati (es. "NOTIFICA EMAIL"):** niente trasparenza sul fondo colorato.
`bg-blue-50/50` lasciava trasparire lo sfondo scuro → box slavato e testo poco leggibile.
La scelta approvata è **colore fisso, identico alla vista chiara** in entrambi i temi:

```diff
- sendEmail ? "bg-blue-50/50 border-blue-100 text-blue-700" : "bg-zinc-50 border-zinc-100 text-zinc-400"
+ sendEmail ? "bg-blue-50 border-blue-200 text-blue-700"    : "bg-zinc-100 border-zinc-200 text-zinc-500"
```

Verifica: `getComputedStyle` di sfondo/bordo/testo deve restituire **lo stesso valore** con
`colorScheme: 'light'` e `colorScheme: 'dark'`.

Verifica strumentata: con `colorScheme: 'dark'` nel contesto Playwright, dopo aver digitato un
indirizzo il campo deve avere `getComputedStyle(el).color === 'rgb(0, 0, 0)'` **e**
`backgroundColor === 'rgb(255, 255, 255)'`.

---

## 8. `overflow-x: hidden` non è una soluzioneSu `html`/`body` è un paracadute, non un fix: **nasconde** lo sforamento (la card resta
larga e il tasto resta fuori schermo). Se lo scroll orizzontale "non c'è" ma un elemento
manca, il colpevole è quasi sempre una colonna `auto` (regola 1).

---

## Procedura di verifica (obbligatoria prima del commit)

Il flag `--window-size` di Chrome headless viene **clampato a ~500px**: non usarlo per il
mobile. Usare `playwright-core` (guida il Chrome già installato, nessun browser da
scaricare) e impostare il viewport via API.

```powershell
npm i --no-save playwright-core
```

```js
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
```

Larghezze da verificare: **320, 360, 390, 412, 430** (+ 768, 1024, 1280, 1920 per il desktop).

Cosa asserire:

1. `document.scrollWidth === clientWidth` per ogni viewport;
2. **nessun** elemento con `getBoundingClientRect().right > clientWidth + 0.5`
   (escludendo i figli di contenitori `overflow-x: auto/scroll`);
3. **nessun** tasto con altezza < 32px;
4. i gruppi centrati hanno `(left+right)/2 === clientWidth/2` (± 1px);
5. i click sono verificati **davvero** (stato che cambia), non solo la geometria.

### Pagine protette da login

```powershell
$env:PROBE_EMAIL='…'; $env:PROBE_PASSWORD='…'   # solo variabili d'ambiente, mai su file
```

Le credenziali non vanno mai scritte nel repository né nei log.
Per misurare senza login si può leggere con la **anon key** (RLS consente la SELECT).

### Pulizia obbligatoria

```powershell
npm rm --no-save playwright-core   # resta fuori da package.json / package-lock.json
```

Rimuovere sempre script temporanei, route di prova e screenshot generati.

---

## Checklist pre-commit

- [ ] Nessuna griglia a colonna singola senza `grid-cols-1`
- [ ] Ogni `truncate` è su un contenitore con `min-w-0`
- [ ] Tutti i tasti ≥ 32px (36–40 su mobile)
- [ ] Nessun wrapper `absolute` a larghezza piena senza `pointer-events-none`
- [ ] Azioni necessarie visibili anche sotto 640px
- [ ] Agenda/calendario mostrano **orario, patente e veicolo** senza aprire l'appuntamento
- [ ] Nessun campo `bg-white` senza `text-black` (o `dark:bg-*`): testo leggibile in tema scuro
- [ ] Le card dell'agenda restano raggruppate per istruttore, `grid-cols-1` per gruppo
- [ ] Misura a 320/360/390/412/430px: 0 elementi fuori schermo
- [ ] `npm run build` e `npx tsc --noEmit` puliti
- [ ] Conteggio ESLint non peggiorato rispetto a `HEAD`
