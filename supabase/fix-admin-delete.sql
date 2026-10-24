-- =====================================================================
--  ROADTRIP — suppression définitive d'un membre (administration)
--  À coller dans : Supabase > SQL Editor > New query > Run
-- =====================================================================

-- Suppression définitive : le membre, ses messages et ses abonnements disparaissent
-- (ses photos sont supprimées par l'appli juste avant)
create or replace function public.admin_delete_member(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  if p_id = auth.uid() then raise exception 'Tu ne peux pas te supprimer toi-même.'; end if;
  delete from public.members where id = p_id;
  begin
    delete from auth.users where id = p_id and is_anonymous;
  exception when others then null; -- le compte de connexion reste, sans conséquence
  end;
end;
$$;

revoke all on function public.admin_delete_member(uuid) from public, anon;
grant execute on function public.admin_delete_member(uuid) to authenticated;
