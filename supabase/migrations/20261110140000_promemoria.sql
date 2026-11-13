-- ============================================================
-- PROMEMORIA: invio una sola volta + promemoria degli "altri impegni"
-- Eseguire in Supabase → SQL Editor (idempotente: si può rilanciare).
-- ============================================================

-- 1) PROMEMORIA AL CLIENTE (email del giorno prima)
--    `promemoria_email_inviato_il` = quando è stata spedita: se non è NULL il cron
--    salta l'appuntamento, così il cliente non riceve più la stessa mail due volte.
alter table appuntamenti
  add column if not exists promemoria_email_inviato_il timestamptz null;

comment on column appuntamenti.promemoria_email_inviato_il is
  'Quando è stata inviata la mail di promemoria al cliente (NULL = non ancora inviata). Serve a non inviarla due volte.';

-- 2) PROMEMORIA AL PROPRIETARIO DEL CALENDARIO (es. "Altri impegni")
--    `promemoria_minuti` = quanti minuti PRIMA avvisare (NULL = mai).
--    `promemoria_inviato_il` = quando è stato spedito (NULL = non ancora).
alter table appuntamenti
  add column if not exists promemoria_minuti integer null,
  add column if not exists promemoria_inviato_il timestamptz null;

comment on column appuntamenti.promemoria_minuti is
  'Minuti di preavviso per il promemoria al proprietario del calendario (NULL = nessun promemoria). 120=2h, 240=4h, 720=12h, 1440=1 giorno.';
comment on column appuntamenti.promemoria_inviato_il is
  'Quando è stato inviato il promemoria al proprietario del calendario (NULL = non ancora inviato).';

-- Indice per trovare velocemente i promemoria da spedire
create index if not exists idx_appuntamenti_promemoria
  on appuntamenti (promemoria_inviato_il)
  where promemoria_inviato_il is null and promemoria_minuti is not null;

-- Verifica
select column_name, data_type
from information_schema.columns
where table_name = 'appuntamenti'
  and column_name like 'promemoria%'
order by column_name;

-- ============================================================
-- PROMEMORIA DEGLI IMPEGNI: serve una chiamata frequente all'endpoint
-- ============================================================
-- Il promemoria "2/4/12 ore prima" deve essere puntuale: l'endpoint
--   https://<dominio>/api/cron/reminders
-- va chiamato ogni 15 minuti. Il cron di Vercel sul piano Hobby gira una sola
-- volta al giorno, quindi si può schedularlo da Supabase (gratis) con pg_cron
-- + pg_net (estensioni già disponibili: Database → Extensions).
--
-- 1) Abilita le estensioni (se non attive): pg_cron, pg_net
-- 2) Salva la URL e il token del cron in una tabella di supporto, oppure incolla
--    direttamente l'URL qui sotto (con CRON_SECRET se configurato su Vercel):
--
-- select cron.schedule(
--   'promemoria-agenda-ogni-15-min',
--   '*/15 * * * *',
--   $$
--     select net.http_get(
--       url := 'https://agenda-guide-manu.vercel.app/api/cron/reminders'
--     );
--   $$
-- );
--
-- Se hai configurato CRON_SECRET su Vercel, usa net.http_get con l'header:
--   select net.http_get(
--     url := 'https://agenda-guide-manu.vercel.app/api/cron/reminders',
--     headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
--   );
--
-- Per controllare i lavori attivi:  select * from cron.job;
-- Per rimuoverli:                   select cron.unschedule('promemoria-agenda-ogni-15-min');

