-- =====================================================================
--  ROADTRIP — schéma Supabase
--  À coller en entier dans : Supabase > SQL Editor > New query > Run
--  Le script peut être relancé sans risque (il ne recrée que ce qui manque).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Codes d'invitation (jamais lisibles depuis l'appli)
-- ---------------------------------------------------------------------
create table if not exists public.invite_codes (
  code  text primary key,
  role  text not null
);
alter table public.invite_codes drop constraint if exists invite_codes_role_check;
alter table public.invite_codes add constraint invite_codes_role_check check (role in ('groupe', 'voyageur', 'admin'));
alter table public.invite_codes enable row level security;
-- Aucune policy : la table n'est lisible que via les fonctions join_group et admin_codes.

-- ---------------------------------------------------------------------
-- 2. Membres (un par téléphone / navigateur)
-- ---------------------------------------------------------------------
create table if not exists public.members (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 40),
  role        text not null check (role in ('groupe', 'voyageur')),
  created_at  timestamptz not null default now()
);
-- Administrateur et retrait d'un membre (ajoutés sans toucher aux données existantes)
alter table public.members add column if not exists is_admin   boolean not null default false;
alter table public.members add column if not exists removed_at timestamptz;
alter table public.members enable row level security;

-- ---------------------------------------------------------------------
-- 3. Messages : texte, photo, poke, « je vais bien », SOS
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null default auth.uid() references public.members (id) on delete cascade,
  kind        text not null check (kind in ('texte', 'photo', 'poke', 'checkin', 'sos')),
  body        text check (char_length(body) <= 2000),
  poke        text check (poke in ('pense', 'cafe', 'calin', 'courage', 'bureau')),
  photo_path  text,
  reply_to    uuid references public.messages (id) on delete set null,
  lat         double precision,
  lng         double precision,
  accuracy    double precision,
  battery     smallint check (battery between 0 and 100),
  country     text check (char_length(country) <= 2),
  created_at  timestamptz not null default now()
);
create index if not exists messages_created_at_idx on public.messages (created_at desc);
-- Liste des pokes autorisés (les anciens restent valides pour les messages déjà envoyés)
alter table public.messages drop constraint if exists messages_poke_check;
alter table public.messages add constraint messages_poke_check
  check (poke in ('pense', 'courage', 'om', 'amuse', 'salut', 'cafe', 'calin', 'bureau'));
alter table public.messages enable row level security;

-- ---------------------------------------------------------------------
-- 4. Abonnements aux notifications (un par appareil)
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  member_id   uuid not null default auth.uid() references public.members (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

-- Journal technique : derniers appels reçus par la fonction send-push (lu par l'écran État de l'installation)
create table if not exists public.app_events (
  kind    text primary key,
  at      timestamptz not null default now(),
  ok      boolean not null,
  detail  text
);
alter table public.app_events enable row level security;

-- ---------------------------------------------------------------------
-- 5. Fonctions utilitaires
-- ---------------------------------------------------------------------
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid() and removed_at is null);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid() and is_admin and removed_at is null);
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.members where id = auth.uid();
$$;

-- Vrai si le message est une réponse à une alerte SOS (ces réponses ne sont jamais mises sous enveloppe)
create or replace function public.is_sos_reply(p_reply_to uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_reply_to is not null
     and exists (select 1 from public.messages where id = p_reply_to and kind = 'sos');
$$;

-- Début du mois en cours, en UTC : le courrier s'ouvre le 1er à 0 h UTC (7 h au Vietnam)
create or replace function public.current_mail_cutoff()
returns timestamptz language sql stable as $$
  select date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
$$;

-- Pour le voyageur : ce qui l'attend sous enveloppe, sans le contenu
create or replace function public.sealed_summary()
returns table (texts int, photos int, pokes int, senders int)
language sql stable security definer set search_path = public as $$
  select count(*) filter (where m.kind = 'texte')::int,
         count(*) filter (where m.kind = 'photo')::int,
         count(*) filter (where m.kind = 'poke')::int,
         count(distinct m.author_id)::int
  from public.messages m
  join public.members a on a.id = m.author_id
  where public.is_member()
    and a.role = 'groupe'
    and m.created_at >= public.current_mail_cutoff()
    and not public.is_sos_reply(m.reply_to);
$$;
grant execute on function public.sealed_summary() to authenticated;

-- Rejoindre le groupe avec un code d'invitation et un prénom
-- Code ADM- : membre du groupe avec les droits d'administration
create or replace function public.join_group(p_code text, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_role    text;
  v_admin   boolean := false;
  v_removed timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Session absente, recharge la page.';
  end if;
  select role into v_role from public.invite_codes where code = upper(trim(p_code));
  if v_role is null then
    raise exception 'Code d''invitation inconnu.';
  end if;
  select removed_at into v_removed from public.members where id = auth.uid();
  if v_removed is not null then
    raise exception 'Ton accès a été retiré par l''administrateur.';
  end if;
  if v_role = 'admin' then
    v_admin := true;
    v_role := 'groupe';
  end if;
  insert into public.members (id, name, role, is_admin)
  values (auth.uid(), trim(p_name), v_role, v_admin)
  on conflict (id) do update
    set name = excluded.name, role = excluded.role, is_admin = public.members.is_admin or excluded.is_admin;
  return case when v_admin then 'admin' else v_role end;
end;
$$;
revoke all on function public.join_group(text, text) from public, anon;
grant execute on function public.join_group(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Règles d'accès (RLS)
-- ---------------------------------------------------------------------
drop policy if exists "members_read"   on public.members;
drop policy if exists "members_rename" on public.members;
create policy "members_read"   on public.members for select to authenticated using (public.is_member());
create policy "members_rename" on public.members for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());
-- Chacun peut seulement changer son prénom (jamais son rôle ni ses droits)
revoke update on public.members from authenticated, anon;
grant update (name) on public.members to authenticated;

drop policy if exists "messages_read"   on public.messages;
drop policy if exists "messages_write"  on public.messages;
drop policy if exists "messages_delete" on public.messages;
-- Le groupe voit tout. Le voyageur voit ses propres messages, les réponses à un SOS,
-- et le courrier du groupe seulement à partir du 1er du mois suivant son envoi.
create policy "messages_read" on public.messages for select to authenticated using (
  public.is_member()
  and (
    public.my_role() = 'groupe'
    or author_id = auth.uid()
    or created_at < public.current_mail_cutoff()
    or public.is_sos_reply(reply_to)
  )
);
create policy "messages_write" on public.messages for insert to authenticated with check (
  public.is_member()
  and author_id = auth.uid()
  and (kind not in ('checkin', 'sos') or public.my_role() = 'voyageur')
);
create policy "messages_delete" on public.messages for delete to authenticated using (author_id = auth.uid());

drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid() and public.is_member());

-- ---------------------------------------------------------------------
-- 7. Stockage des photos (privé, visible des seuls membres)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "photos_read"   on storage.objects;
drop policy if exists "photos_upload" on storage.objects;
drop policy if exists "photos_admin_delete" on storage.objects;
create policy "photos_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());
create policy "photos_read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_member());
create policy "photos_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member()
              and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 8. Temps réel : le fil se met à jour tout seul
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 9. Administration (réservé au membre entré avec le code ADM-)
-- ---------------------------------------------------------------------
create or replace function public.admin_members()
returns table (id uuid, name text, role text, is_admin boolean, created_at timestamptz, removed_at timestamptz, devices int)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.role, m.is_admin, m.created_at, m.removed_at,
         (select count(*) from public.push_subscriptions p where p.member_id = m.id)::int
  from public.members m
  where public.is_admin()
  order by m.removed_at nulls first, m.role desc, m.is_admin desc, m.name;
$$;

-- Retirer un membre : il perd l'accès tout de suite, ses messages restent visibles
create or replace function public.admin_remove_member(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  if p_id = auth.uid() then raise exception 'Tu ne peux pas te retirer toi-même.'; end if;
  update public.members set removed_at = now() where id = p_id;
  delete from public.push_subscriptions where member_id = p_id;
end;
$$;

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

create or replace function public.admin_restore_member(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  update public.members set removed_at = null where id = p_id;
end;
$$;

create or replace function public.admin_codes()
returns table (role text, code text)
language sql stable security definer set search_path = public as $$
  select c.role, c.code from public.invite_codes c where public.is_admin()
  order by case c.role when 'groupe' then 1 when 'voyageur' then 2 else 3 end;
$$;

-- Nouveau code pour un rôle : l'ancien cesse de fonctionner (les membres déjà inscrits ne sont pas touchés)
create or replace function public.admin_regenerate_code(p_role text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  if p_role not in ('groupe', 'voyageur', 'admin') then raise exception 'Rôle inconnu.'; end if;
  v_code := case p_role when 'groupe' then 'GRP-' when 'voyageur' then 'VOY-' else 'ADM-' end
            || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  delete from public.invite_codes where role = p_role;
  insert into public.invite_codes (code, role) values (v_code, p_role);
  return v_code;
end;
$$;

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

-- État de l'installation : ce que la base peut vérifier elle-même
create or replace function public.admin_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cron boolean := exists (select 1 from pg_extension where extname = 'pg_cron');
  v_net  boolean := exists (select 1 from pg_extension where extname = 'pg_net');
  v_job  jsonb;
  v_last jsonb;
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  if v_cron then
    begin
      execute $q$ select jsonb_build_object('name', jobname, 'active', active, 'schedule', schedule)
                  from cron.job where jobname = 'courrier-mensuel' or command ilike '%send-push%'
                  order by (jobname = 'courrier-mensuel') desc limit 1 $q$ into v_job;
      execute $q$ select jsonb_build_object('status', d.status, 'at', d.start_time)
                  from cron.job_run_details d join cron.job j on j.jobid = d.jobid
                  where j.jobname = 'courrier-mensuel' or j.command ilike '%send-push%'
                  order by d.start_time desc limit 1 $q$ into v_last;
    exception when others then v_job := null;
    end;
  end if;
  return jsonb_build_object(
    'schema',   true,
    'bucket',   exists (select 1 from storage.buckets where id = 'photos'),
    'realtime', exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'),
    'webhook',  exists (select 1 from pg_trigger where tgrelid = 'public.messages'::regclass and not tgisinternal),
    'pg_cron',  v_cron,
    'pg_net',   v_net,
    'cron_job', v_job,
    'cron_last', v_last,
    'traveler', exists (select 1 from public.members where role = 'voyageur' and removed_at is null),
    'members',  (select count(*) from public.members where removed_at is null),
    'devices',  (select count(*) from public.push_subscriptions),
    'events',   (select coalesce(jsonb_object_agg(kind, jsonb_build_object('at', at, 'ok', ok, 'detail', detail)), '{}'::jsonb) from public.app_events)
  );
end;
$$;

revoke all on function public.admin_delete_member(uuid) from public, anon;
grant execute on function public.admin_delete_member(uuid) to authenticated;
revoke all on function public.admin_members(), public.admin_remove_member(uuid), public.admin_restore_member(uuid),
  public.admin_codes(), public.admin_regenerate_code(text), public.admin_reset(text), public.admin_status() from public, anon;
grant execute on function public.admin_members(), public.admin_remove_member(uuid), public.admin_restore_member(uuid),
  public.admin_codes(), public.admin_regenerate_code(text), public.admin_reset(text), public.admin_status() to authenticated;

-- ---------------------------------------------------------------------
-- 10. Génération des codes d'invitation (une seule fois)
-- ---------------------------------------------------------------------
insert into public.invite_codes (code, role)
select 'GRP-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)), 'groupe'
where not exists (select 1 from public.invite_codes where role = 'groupe');

insert into public.invite_codes (code, role)
select 'VOY-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)), 'voyageur'
where not exists (select 1 from public.invite_codes where role = 'voyageur');

insert into public.invite_codes (code, role)
select 'ADM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), 'admin'
where not exists (select 1 from public.invite_codes where role = 'admin');

-- Affiche les codes : GRP- pour les collègues, VOY- pour le voyageur, ADM- pour l'administrateur (toi seul)
select role, code from public.invite_codes order by role;
