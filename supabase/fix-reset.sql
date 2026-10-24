-- =====================================================================
--  ROADTRIP — correctif de la remise à zéro
--  À coller dans : Supabase > SQL Editor > New query > Run
-- =====================================================================

-- Remise à zéro : efface messages, membres et abonnements, sauf l'administrateur qui la lance
create or replace function public.admin_reset(p_confirm text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  if p_confirm is distinct from 'EFFACER' then raise exception 'Tape EFFACER pour confirmer.'; end if;
  delete from public.messages where id is not null; -- Supabase refuse un DELETE sans WHERE venant de l'appli
  delete from public.push_subscriptions where member_id <> auth.uid();
  delete from public.members where id <> auth.uid();
  begin
    delete from auth.users where is_anonymous and id <> auth.uid();
  exception when others then null; -- les comptes de connexion restent, sans conséquence
  end;
  return 'ok';
end;
$$;
