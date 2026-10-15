-- Atípico (nom provisoire) : schéma v1, Postgres sur Supabase.
-- Accès : RLS Postgres sur chaque table. auth.users est fourni par Supabase Auth.

create extension if not exists pgcrypto;

-- Profils ----------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null unique check (char_length(pseudo) between 3 and 30),
  birth_date date not null check (birth_date <= current_date - interval '18 years'),
  city text not null,
  lat double precision,
  lng double precision,
  bio text check (char_length(bio) <= 1000),
  looking_for text[] not null default '{amistad}',      -- amistad | pareja | actividades
  avatar_url text,
  lang text not null default 'es' check (lang in ('es','fr','en')),
  standby boolean not null default false,               -- profil masqué
  consent_at timestamptz not null,                      -- RGPD art. 9 : consentement explicite (donnée de santé)
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on profiles (city) where not standby;

create table traits (
  id smallint primary key generated always as identity,
  slug text not null unique,
  label_es text not null
);

create table profile_traits (
  profile_id uuid not null references profiles(id) on delete cascade,
  trait_id smallint not null references traits(id) on delete cascade,
  primary key (profile_id, trait_id)
);
create index on profile_traits (trait_id);

-- Événements -------------------------------------------------------------
create table events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) <= 4000),
  city text not null,
  address text,                                         -- null = en ligne
  lat double precision,
  lng double precision,
  start_at timestamptz not null,
  end_at timestamptz,
  capacity int check (capacity is null or capacity between 2 and 500),
  ambiance smallint not null default 2 check (ambiance between 1 and 3),  -- 1 calme, 3 animé
  status text not null default 'open' check (status in ('open','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_at is null or end_at > start_at)
);
create index on events (city, start_at) where status = 'open';
create index on events (creator_id);

create table participations (
  event_id uuid not null references events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  status text not null check (status in ('going','waitlist','interested')),
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
create index on participations (profile_id);
create index on participations (event_id, status, created_at);

create table event_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index on event_posts (event_id, created_at);

-- Rencontres -------------------------------------------------------------
create table favorites (
  from_id uuid not null references profiles(id) on delete cascade,
  to_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index on favorites (to_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index on messages (recipient_id, created_at desc);
create index on messages (sender_id, recipient_id, created_at desc);

-- Sécurité ---------------------------------------------------------------
create table blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create index on blocks (blocked_id);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile','event','post','message')),
  target_id uuid not null,
  reason text not null check (reason in ('acoso','perfil_falso','spam','odio','angustia','otro')),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index on reports (status, created_at);

-- Règles métier ----------------------------------------------------------

create function is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- Peut écrire si : match mutuel, OU même événement (going), OU l'autre lui a déjà écrit. Jamais si bloqué.
create function can_message(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not is_blocked(a, b) and (
    exists (select 1 from favorites f1 join favorites f2
            on f1.from_id = f2.to_id and f1.to_id = f2.from_id
            where f1.from_id = a and f1.to_id = b)
    or exists (select 1 from participations p1 join participations p2 using (event_id)
               where p1.profile_id = a and p2.profile_id = b
                 and p1.status = 'going' and p2.status = 'going')
    or exists (select 1 from messages where sender_id = b and recipient_id = a)
  );
$$;

-- Rejoindre : verrouille l'événement pour que deux inscriptions simultanées ne dépassent pas la capacité.
create function join_event(e uuid) returns text
language plpgsql security definer set search_path = public as $$
declare ev events; taken int; st text;
begin
  select * into ev from events where id = e for update;
  if ev is null or ev.status <> 'open' or ev.start_at < now() then raise exception 'event_closed'; end if;
  if is_blocked(auth.uid(), ev.creator_id) then raise exception 'blocked'; end if;
  select count(*) into taken from participations where event_id = e and status = 'going';
  st := case when ev.capacity is null or taken < ev.capacity then 'going' else 'waitlist' end;
  insert into participations (event_id, profile_id, status) values (e, auth.uid(), st)
    on conflict (event_id, profile_id) do update set status = excluded.status, created_at = now()
    where participations.status <> 'going';
  return st;
end $$;

-- Quitter : libère la place et promeut le premier de la liste d'attente.
create function leave_event(e uuid) returns void
language plpgsql security definer set search_path = public as $$
declare was text;
begin
  perform 1 from events where id = e for update;
  delete from participations where event_id = e and profile_id = auth.uid() returning status into was;
  if was = 'going' then
    update participations set status = 'going'
      where (event_id, profile_id) = (
        select event_id, profile_id from participations
        where event_id = e and status = 'waitlist' order by created_at limit 1);
  end if;
end $$;

-- RLS --------------------------------------------------------------------
alter table profiles enable row level security;
alter table traits enable row level security;
alter table profile_traits enable row level security;
alter table events enable row level security;
alter table participations enable row level security;
alter table event_posts enable row level security;
alter table favorites enable row level security;
alter table messages enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;

create policy read_profiles on profiles for select to authenticated
  using ((not standby or id = auth.uid()) and not is_blocked(auth.uid(), id));
create policy own_profile_ins on profiles for insert to authenticated with check (id = auth.uid());
create policy own_profile_upd on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and is_admin = false);

create policy read_traits on traits for select using (true);
create policy read_pt on profile_traits for select to authenticated using (true);
create policy own_pt on profile_traits for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Événements visibles aussi sans compte (SEO, partage WhatsApp).
create policy read_events on events for select using (true);
create policy create_event on events for insert to authenticated with check (creator_id = auth.uid());
create policy edit_event on events for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy delete_event on events for delete to authenticated
  using (creator_id = auth.uid()
         and not exists (select 1 from participations where event_id = events.id and profile_id <> auth.uid()));

-- Inscriptions : lecture pour les membres ; écriture uniquement via join_event / leave_event.
create policy read_part on participations for select to authenticated using (true);
create policy mark_interested on participations for insert to authenticated
  with check (profile_id = auth.uid() and status = 'interested');

create policy read_posts on event_posts for select to authenticated using (not hidden or author_id = auth.uid());
create policy write_post on event_posts for insert to authenticated
  with check (author_id = auth.uid() and exists (
    select 1 from participations p where p.event_id = event_posts.event_id
      and p.profile_id = auth.uid() and p.status = 'going'));
create policy delete_post on event_posts for delete to authenticated using (author_id = auth.uid());

create policy read_fav on favorites for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());
create policy add_fav on favorites for insert to authenticated
  with check (from_id = auth.uid() and not is_blocked(from_id, to_id));
create policy del_fav on favorites for delete to authenticated using (from_id = auth.uid());

create policy read_msg on messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy send_msg on messages for insert to authenticated
  with check (sender_id = auth.uid() and can_message(sender_id, recipient_id));
create policy mark_read on messages for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy own_blocks on blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy file_report on reports for insert to authenticated with check (reporter_id = auth.uid());
create policy read_own_report on reports for select to authenticated using (reporter_id = auth.uid());
-- Les admins passent par la clé service (dashboard Supabase) : pas de policy admin en v1.

revoke update on messages from authenticated;
grant update (read_at) on messages to authenticated;
grant execute on function join_event(uuid), leave_event(uuid), can_message(uuid, uuid) to authenticated;

-- Traits de départ (modifiables ensuite depuis le dashboard Supabase).
insert into traits (slug, label_es) values
 ('curiosidad','Curiosidad'),('hiperfoco','Hiperfoco'),('creatividad','Creatividad'),
 ('introversion','Introversión'),('sensibilidad_ruido','Sensible al ruido'),('humor_absurdo','Humor absurdo'),
 ('empatia','Empatía'),('impulsividad','Impulsividad'),('intereses_intensos','Intereses intensos'),
 ('necesito_rutinas','Necesito rutinas'),('nocturno','Nocturno/a'),('naturaleza','Naturaleza'),
 ('juegos_mesa','Juegos de mesa'),('lectura','Lectura'),('musica','Música'),('tecnologia','Tecnología');
