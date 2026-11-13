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
-- SCHEDULAZIONE DEL CRON (automatica): chiama /api/cron/reminders ogni 15 minuti
-- ============================================================
-- Perché serve: i preavvisi "2/4/12 ore prima" devono essere PUNTUALI. Il cron di
-- Vercel sul piano Hobby gira una sola volta al giorno e non incontrerebbe mai la
-- finestra giusta (promemoria mai inviato). Qui lo schedula Supabase con pg_cron +
-- pg_net: nessun servizio esterno, nessun costo.
--
-- Se il blocco qui sotto non riesce (estensioni non disponibili), abilita a mano
-- Database → Extensions → pg_cron e pg_net e rilancia questo file.
do $$
begin
  -- Estensioni (se già attive non fa nulla)
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron non disponibile: %', sqlerrm;
  end;
  begin
    create extension if not exists pg_net;
  exception when others then
    raise notice 'pg_net non disponibile: %', sqlerrm;
  end;

  -- Rimuove l'eventuale job precedente (migrazione ri-eseguibile)
  begin
    if exists (select 1 from cron.job where jobname = 'promemoria-agenda-ogni-15-min') then
      perform cron.unschedule('promemoria-agenda-ogni-15-min');
    end if;
  exception when others then
    raise notice 'Impossibile rimuovere il job precedente: %', sqlerrm;
  end;

  -- Schedula ogni 15 minuti la chiamata all'endpoint dei promemoria.
  -- Se su Vercel hai configurato CRON_SECRET, sostituisci la query con la versione
  -- con header (la trovi in fondo al file, commentata).
  begin
    perform cron.schedule(
      'promemoria-agenda-ogni-15-min',
      '*/15 * * * *',
      $cron$ select net.http_get('https://agenda-guide-manu.vercel.app/api/cron/reminders'); $cron$
    );
    raise notice 'OK: cron promemoria schedato ogni 15 minuti';
  exception when others then
    raise notice 'Impossibile schedulare il cron: % (schedula a mano, vedi commenti in fondo)', sqlerrm;
  end;
end $$;

-- Controlli utili:
--   select jobid, jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select cron.unschedule('promemoria-agenda-ogni-15-min');

-- Versione CON header (se hai CRON_SECRET su Vercel):
--   select cron.schedule(
--     'promemoria-agenda-ogni-15-min',
--     '*/15 * * * *',
--     $$
--       select net.http_get(
--         url := 'https://agenda-guide-manu.vercel.app/api/cron/reminders',
--         headers := jsonb_build_object('Authorization', 'Bearer IL_TUO_CRON_SECRET')
--       );
--     $$
--   );

