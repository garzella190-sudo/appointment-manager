-- ============================================================
-- PULIZIA DEI VECCHI PROMEMORIA (mail doppie)
-- Eseguire in Supabase → SQL Editor (idempotente: si può rilanciare).
-- ============================================================
-- Cosa succedeva: due job pg_cron chiamavano la vecchia edge function
-- `send-reminders` (poi rimossa dal repository ma ancora deployata):
--
--   send-reminders-24h      '0 4 * * *'    → 04:00 UTC (05:00 italiana)
--   send-reminders-morning  '30 7 * * *'   → 07:30 UTC (08:30 italiana)
--
-- Quella function non aveva alcun marcatore "già inviato" e mandava il
-- promemoria a TUTTI gli appuntamenti della giornata: il cliente riceveva
-- la stessa mail due volte (più una dal nostro cron). Da qui la segnalazione
-- "alcuni clienti ricevono più di una mail di promemoria".
--
-- Ora l'unico mittente è /api/cron/reminders, che scrive
-- `promemoria_email_inviato_il` PRIMA di spedire (una sola mail per appuntamento).
-- ============================================================

-- 1) Rimuove tutti i job che chiamano la vecchia function
do $$
declare
  r record;
  rimossi int := 0;
begin
  for r in
    select jobid, jobname
    from cron.job
    where command ilike '%send-reminders%'
  loop
    perform cron.unschedule(r.jobid);
    rimossi := rimossi + 1;
    raise notice 'Rimosso job "%" (jobid %)', r.jobname, r.jobid;
  end loop;

  raise notice 'Job della vecchia function rimossi: %', rimossi;
exception when others then
  raise notice 'Impossibile ripulire i job: %', sqlerrm;
end $$;

-- 2) Assicura il NOSTRO cron: chiama l'endpoint giusto ogni 15 minuti
--    (serve perché i preavvisi "2/4/12 ore prima" devono essere puntuali:
--     il cron di Vercel sul piano Hobby gira una sola volta al giorno).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'promemoria-agenda-ogni-15-min') then
    perform cron.unschedule('promemoria-agenda-ogni-15-min');
  end if;

  perform cron.schedule(
    'promemoria-agenda-ogni-15-min',
    '*/15 * * * *',
    $cron$ select net.http_get('https://agenda-guide-manu.vercel.app/api/cron/reminders'); $cron$
  );

  raise notice 'OK: cron dei promemoria schedato ogni 15 minuti';
exception when others then
  raise notice 'Impossibile schedulare il cron: % (abilita pg_cron e pg_net, poi rilancia)', sqlerrm;
end $$;

-- 3) Verifica: deve restare SOLO `promemoria-agenda-ogni-15-min`
select jobid, jobname, schedule, active, left(command, 90) as command
from cron.job
order by jobid;

-- 4) Gli ultimi invii, per controllare che giri (dopo qualche quarto d'ora)
-- select jobname, status, start_time
-- from cron.job_run_details
-- order by start_time desc
-- limit 10;
