-- =====================================================================
--  OS Corsica Connect — levée du courrier, le 1er de chaque mois
--  À exécuter une seule fois dans : Supabase > SQL Editor, APRÈS avoir activé
--  les extensions pg_cron et pg_net (Database > Extensions).
--
--  Remplace les deux valeurs entre < > avant de lancer :
--   <PROJECT_REF>     : l'identifiant du projet, visible dans l'URL du projet (https://<PROJECT_REF>.supabase.co)
--   <WEBHOOK_SECRET>  : la même phrase que le secret WEBHOOK_SECRET de la fonction send-push
-- =====================================================================

-- Le 1er de chaque mois à 0 h 05 UTC (7 h 05 au Vietnam, 1 h 05 à Paris en hiver)
select cron.schedule(
  'courrier-mensuel',
  '5 0 1 * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '<WEBHOOK_SECRET>'),
    body    := jsonb_build_object('type', 'MONTHLY')
  );
  $$
);

-- Vérifier que la tâche est bien enregistrée :
-- select jobname, schedule from cron.job;
-- La supprimer si besoin :
-- select cron.unschedule('courrier-mensuel');
