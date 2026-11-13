-- ============================================================
-- PROMEMORIA PROGRAMMATO DIRETTAMENTE IN RESEND (niente cron frequente)
-- Eseguire in Supabase → SQL Editor (idempotente: si può rilanciare).
-- ============================================================
-- Come funziona ora:
--   1) alla prenotazione parte SUBITO la mail di conferma;
--   2) nello stesso momento la mail di promemoria viene PROGRAMMATA su Resend
--      per l'istante esatto "inizio guida − 24 ore".
--
-- `promemoria_email_id` = id dell'email programmata su Resend: serve per
-- annullarla o riprogrammarla se la guida viene spostata o cancellata.
-- `promemoria_email_per` = istante in cui è programmata (solo diagnostica).
--
-- Con questo non serve più chiamare /api/cron/reminders ogni 15 minuti:
-- il cron giornaliero resta solo come rete di sicurezza.
-- ============================================================

alter table appuntamenti
  add column if not exists promemoria_email_id text null,
  add column if not exists promemoria_email_per timestamptz null;

comment on column appuntamenti.promemoria_email_id is
  'ID Resend dell''email di promemoria programmata per "inizio - 24h". Serve per annullarla o riprogrammarla.';
comment on column appuntamenti.promemoria_email_per is
  'Istante in cui è programmata la mail di promemoria (diagnostica).';

-- Trova in fretta le guide con promemoria ancora da programmare
create index if not exists idx_appuntamenti_promemoria_da_programmare
  on appuntamenti (inizio)
  where send_email = true and promemoria_email_inviato_il is null and promemoria_email_id is null;

-- Verifica
select column_name, data_type
from information_schema.columns
where table_name = 'appuntamenti'
  and column_name like 'promemoria%'
order by column_name;
