-- =====================================================================
--  ROADTRIP — nouveaux pokes
--  À coller dans : Supabase > SQL Editor > New query > Run
-- =====================================================================

-- Liste des pokes autorisés (les anciens restent valides pour les messages déjà envoyés)
alter table public.messages drop constraint if exists messages_poke_check;
alter table public.messages add constraint messages_poke_check
  check (poke in ('pense', 'courage', 'om', 'amuse', 'salut', 'cafe', 'calin', 'bureau'));
