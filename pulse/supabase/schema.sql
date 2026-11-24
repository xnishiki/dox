-- =====================================================================
-- Pulse — схема базы Supabase
-- Выполните целиком в Supabase: SQL Editor → New query → Run.
-- Скрипт можно запускать повторно.
-- =====================================================================

-- ---------- Профили ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_.-]{3,24}$'),
  created_at timestamptz not null default now()
);

-- Профиль создаётся автоматически при регистрации (имя берётся из метаданных signUp)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := coalesce(nullif(regexp_replace(new.raw_user_meta_data ->> 'username', '[^A-Za-z0-9_.-]', '', 'g'), ''), 'user');
  candidate text := left(base, 24);
  n int := 0;
begin
  if length(candidate) < 3 then candidate := candidate || '_user'; end if;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := left(base, 20) || n::text;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Плейлисты ----------
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  cover_data text check (cover_data is null or char_length(cover_data) <= 400000),
  visibility text not null default 'private' check (visibility in ('private', 'link', 'public')),
  collaborative boolean not null default false,
  share_code text not null unique check (share_code ~ '^PULSE-[A-Z0-9]{4}$'),
  tracks jsonb not null default '[]'::jsonb check (jsonb_typeof(tracks) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists playlists_owner_idx on public.playlists (owner_id);
create index if not exists playlists_public_name_idx on public.playlists (lower(name)) where visibility = 'public';

-- Соавторы плейлиста
create table if not exists public.playlist_members (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (playlist_id, user_id)
);

-- Подписки на чужие плейлисты
create table if not exists public.playlist_follows (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (playlist_id, user_id)
);

-- Синхронизация личных данных: «Нравится», история и настройки «Потока»
create table if not exists public.user_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  liked jsonb not null default '[]'::jsonb,
  taste jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Вспомогательные функции (security definer, чтобы политики не зацикливались) ----------
create or replace function public.is_playlist_owner(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from playlists where id = pid and owner_id = auth.uid());
$$;

create or replace function public.is_playlist_member(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from playlist_members where playlist_id = pid and user_id = auth.uid());
$$;

-- Соавтор может менять только треки; остальные поля — только владелец
create or replace function public.guard_playlist_update()
returns trigger language plpgsql as $$
begin
  if old.owner_id <> auth.uid() then
    if new.name is distinct from old.name or new.description is distinct from old.description
       or new.cover_data is distinct from old.cover_data or new.visibility is distinct from old.visibility
       or new.collaborative is distinct from old.collaborative or new.share_code is distinct from old.share_code
       or new.owner_id is distinct from old.owner_id then
      raise exception 'Только владелец может менять настройки плейлиста';
    end if;
  end if;
  new.updated_at := greatest(new.updated_at, now());
  return new;
end $$;

drop trigger if exists playlists_guard on public.playlists;
create trigger playlists_guard before update on public.playlists
  for each row execute function public.guard_playlist_update();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_members enable row level security;
alter table public.playlist_follows enable row level security;
alter table public.user_state enable row level security;

drop policy if exists "profiles: читать могут все вошедшие" on public.profiles;
create policy "profiles: читать могут все вошедшие" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles: менять только свой" on public.profiles;
create policy "profiles: менять только свой" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Плейлист видят: владелец, соавторы, все — если он публичный или «по ссылке»
drop policy if exists "playlists: чтение" on public.playlists;
create policy "playlists: чтение" on public.playlists
  for select to authenticated
  using (visibility in ('public', 'link') or owner_id = auth.uid() or public.is_playlist_member(id));

drop policy if exists "playlists: создание" on public.playlists;
create policy "playlists: создание" on public.playlists
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "playlists: изменение" on public.playlists;
create policy "playlists: изменение" on public.playlists
  for update to authenticated
  using (owner_id = auth.uid() or (collaborative and public.is_playlist_member(id)))
  with check (owner_id = auth.uid() or (collaborative and public.is_playlist_member(id)));

drop policy if exists "playlists: удаление" on public.playlists;
create policy "playlists: удаление" on public.playlists
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "members: чтение" on public.playlist_members;
create policy "members: чтение" on public.playlist_members
  for select to authenticated using (user_id = auth.uid() or public.is_playlist_owner(playlist_id) or public.is_playlist_member(playlist_id));
drop policy if exists "members: приглашает владелец" on public.playlist_members;
create policy "members: приглашает владелец" on public.playlist_members
  for insert to authenticated with check (public.is_playlist_owner(playlist_id));
drop policy if exists "members: удалить себя или владелец" on public.playlist_members;
create policy "members: удалить себя или владелец" on public.playlist_members
  for delete to authenticated using (user_id = auth.uid() or public.is_playlist_owner(playlist_id));

drop policy if exists "follows: свои" on public.playlist_follows;
create policy "follows: свои" on public.playlist_follows
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_state: своё" on public.user_state;
create policy "user_state: своё" on public.user_state
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- RPC ----------
-- Вход по коду PULSE-XXXX: совместный плейлист — становишься соавтором,
-- плейлист «по ссылке» или публичный — подписываешься.
create or replace function public.join_by_code(code text)
returns table (playlist_id uuid, role text)
language plpgsql security definer set search_path = public as $$
declare
  p playlists;
begin
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  select * into p from playlists where share_code = upper(trim(code));
  if not found then raise exception 'Плейлист с таким кодом не найден'; end if;
  if p.owner_id = auth.uid() then
    return query select p.id, 'owner'::text; return;
  end if;
  if p.collaborative then
    insert into playlist_members (playlist_id, user_id) values (p.id, auth.uid()) on conflict do nothing;
    return query select p.id, 'editor'::text; return;
  end if;
  if p.visibility in ('link', 'public') then
    insert into playlist_follows (playlist_id, user_id) values (p.id, auth.uid()) on conflict do nothing;
    return query select p.id, 'follower'::text; return;
  end if;
  raise exception 'Плейлист закрыт владельцем';
end $$;

-- Приглашение соавтора по имени пользователя (только владелец)
create or replace function public.invite_member(pid uuid, member_username text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  if not exists (select 1 from playlists where id = pid and owner_id = auth.uid()) then
    raise exception 'Приглашать может только владелец';
  end if;
  select id into uid from profiles where lower(username) = lower(trim(member_username));
  if uid is null then raise exception 'Пользователь не найден'; end if;
  if uid = auth.uid() then raise exception 'Это вы'; end if;
  update playlists set collaborative = true where id = pid;
  insert into playlist_members (playlist_id, user_id) values (pid, uid) on conflict do nothing;
end $$;

-- Атомарное добавление треков (два соавтора одновременно не затрут друг друга)
create or replace function public.append_tracks(pid uuid, new_tracks jsonb)
returns void language sql security invoker set search_path = public as $$
  update playlists set tracks = tracks || new_tracks, updated_at = now() where id = pid;
$$;

grant execute on function public.join_by_code(text) to authenticated;
grant execute on function public.invite_member(uuid, text) to authenticated;
grant execute on function public.append_tracks(uuid, jsonb) to authenticated;
