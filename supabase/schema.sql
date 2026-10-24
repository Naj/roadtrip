-- =====================================================================
--  OS Corsica Connect — schéma Supabase
--  À coller en entier dans : Supabase > SQL Editor > New query > Run
--  Le script peut être relancé sans risque (il ne recrée que ce qui manque).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Codes d'invitation (jamais lisibles depuis l'appli)
-- ---------------------------------------------------------------------
create table if not exists public.invite_codes (
  code  text primary key,
  role  text not null check (role in ('groupe', 'voyageur'))
);
alter table public.invite_codes enable row level security;
-- Aucune policy : la table n'est accessible que via la fonction join_group.

-- ---------------------------------------------------------------------
-- 2. Membres (un par téléphone / navigateur)
-- ---------------------------------------------------------------------
create table if not exists public.members (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 40),
  role        text not null check (role in ('groupe', 'voyageur')),
  created_at  timestamptz not null default now()
);
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

-- ---------------------------------------------------------------------
-- 5. Fonctions utilitaires
-- ---------------------------------------------------------------------
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid());
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
create or replace function public.join_group(p_code text, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Session absente, recharge la page.';
  end if;
  select role into v_role from public.invite_codes where code = upper(trim(p_code));
  if v_role is null then
    raise exception 'Code d''invitation inconnu.';
  end if;
  insert into public.members (id, name, role)
  values (auth.uid(), trim(p_name), v_role)
  on conflict (id) do update set name = excluded.name, role = excluded.role;
  return v_role;
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
-- 9. Génération des deux codes d'invitation (une seule fois)
-- ---------------------------------------------------------------------
insert into public.invite_codes (code, role)
select 'GRP-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)), 'groupe'
where not exists (select 1 from public.invite_codes where role = 'groupe');

insert into public.invite_codes (code, role)
select 'VOY-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)), 'voyageur'
where not exists (select 1 from public.invite_codes where role = 'voyageur');

-- Affiche les codes à distribuer (GRP- pour les collègues, VOY- pour le voyageur uniquement)
select role, code from public.invite_codes order by role;
