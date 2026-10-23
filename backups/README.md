# 📦 Sistema di Backup Automatico — Appointment Manager

Questo modulo gestisce i backup completi di sicurezza del database Supabase a costo zero.

---

## 1. Come funziona il Backup Automatico (GitHub Actions)

Nel repository è presente il workflow [`.github/workflows/backup.yml`](../.github/workflows/backup.yml):

- **Frequenza:** Si avvia in automatico **ogni notte alle 02:00 UTC** (03:00 / 04:00 ora italiana).
- **Manuale (On Demand):** Puoi avviarlo in qualunque momento andando su GitHub nella scheda **Actions** → **Database Backup (Supabase)** → clic su **"Run workflow"**.
- **Conservazione:** I file `.tar.gz` compressi vengono archiviati negli **Artifacts** di GitHub e conservati per **90 giorni** gratuitamente.

### Configurazione Secrets su GitHub:
Su GitHub (nel repository -> `Settings` -> `Secrets and variables` -> `Actions`):
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `SUPABASE_SERVICE_ROLE_KEY` (o `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

---

## 2. Backup Manuale Locale (dal tuo PC)

Puoi salvare una copia immediata di tutte le tabelle sul tuo computer con un singolo comando da terminale:

```bash
npm run backup
```

Verrà creata una cartella `backups/backup_YYYY-MM-DD` contenente:
- `clienti.json`
- `istruttori.json`
- `veicoli.json`
- `patenti.json`
- `appuntamenti.json` (con paginazione automatica, nessun limite di 1000 righe)
- `sessioni_esame.json`
- `impegni.json`
- `push_subscriptions.json`
- `_metadata.json` (conteggio totale dei record e data esatta)

---

## 3. Privacy e Sicurezza

La cartella dei dati esportati (`backups/backup_*`) è inserita in `.gitignore`: nessun dato personale degli allievi (telefoni, nomi) verrà mai caricato accidentalmente nei commit git pubblici.
