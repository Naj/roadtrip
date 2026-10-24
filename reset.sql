-- =====================================================================
--  ROADTRIP — remise à zéro des données (après les tests, avant le départ)
--  À coller dans : Supabase > SQL Editor > New query > Run
--
--  Efface : tous les messages, les abonnements aux notifications et les membres.
--  Garde  : les codes d'invitation, les réglages, la fonction et la tâche du 1er du mois.
--  Chaque personne devra rejoindre à nouveau le groupe avec son code.
--
--  Les photos se suppriment à part : Storage > photos > tout sélectionner > Delete.
-- =====================================================================

delete from public.messages;
delete from public.push_subscriptions;
delete from public.members;

-- Comptes de connexion anonymes devenus inutiles
delete from auth.users where is_anonymous;

-- Contrôle : les trois compteurs doivent être à 0
select
  (select count(*) from public.messages)           as messages,
  (select count(*) from public.members)            as membres,
  (select count(*) from public.push_subscriptions) as abonnements;
