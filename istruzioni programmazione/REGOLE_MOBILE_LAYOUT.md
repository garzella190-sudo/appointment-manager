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

## 7. Stessi controlli = stesso gruppo tra pagine

Il gruppo `‹ OGGI › | 📅` deve essere **identico** su Agenda e Calendario: stessi tasti,
stesso ordine, stesse misure, stessa posizione (centrato).

| | Mobile | Desktop |
|---|---|---|
| Gruppo | 148 × 44 | 192 × 40 |
| Tasti | `32×36 · 40×36 · 32×36 · 32×36` | `32×32 · 57×32 · 32×32 · 32×32` |

Non reinventare il controllo su ogni pagina: copiare le classi.

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
- [ ] Misura a 320/360/390/412/430px: 0 elementi fuori schermo
- [ ] `npm run build` e `npx tsc --noEmit` puliti
- [ ] Conteggio ESLint non peggiorato rispetto a `HEAD`
