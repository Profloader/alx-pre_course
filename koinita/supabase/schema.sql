-- ============================================================================
-- KOINITA BOOK CLUB — Supabase PostgreSQL Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ============================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── Helper: updated_at trigger ───────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ============================================================================
-- SETTINGS  (single row — founding cap + moderation config)
-- ============================================================================
create table if not exists settings (
  id               bool primary key default true
                     constraint one_row check (id),
  staff_editor_name text not null default 'Staff Editor',
  auto_approve     bool not null default true,
  founding_cap     int  not null default 25000,
  founder_count    int  not null default 0
);
insert into settings default values on conflict do nothing;

-- ============================================================================
-- PROFILES  (extends auth.users — created on first sign-in)
-- ============================================================================
create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  name          text not null,
  email         text not null,
  role          text not null default 'reader'
                  check (role in ('reader','author')),
  bio           text not null default '',
  avatar        text not null default '#D9541F',
  plan          text not null default 'starter'
                  check (plan in ('starter','indie','pro','inhouse')),
  inhouse       bool not null default false,
  admin         bool not null default false,
  muted_staff   bool not null default false,
  -- Founding members
  founder       bool not null default false,
  founder_no    int,
  invite_code   text unique not null
                  default encode(gen_random_bytes(6), 'hex'),
  invites       int not null default 0,
  charter       bool not null default false,
  -- Notifications
  notif_email   bool not null default true,
  notif_push    bool not null default false,
  push_primed   bool not null default false,
  -- Timestamps
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- BOOKS
-- ============================================================================
create table if not exists books (
  id             uuid primary key default uuid_generate_v4(),
  title          text not null,
  author_user_id uuid references profiles(id) on delete set null,
  author_name    text not null,
  genre          text not null,
  blurb          text not null default '',
  cover          int  not null default 0,
  featured       bool not null default false,
  status         text not null default 'approved'
                   check (status in ('approved','pending','rejected')),
  free_start     timestamptz,
  free_end       timestamptz,
  asin           text,
  amazon_url     text,
  added          timestamptz not null default now()
);

-- ============================================================================
-- POSTS  (reader & author feed)
-- ============================================================================
create table if not exists posts (
  id         uuid primary key default uuid_generate_v4(),
  author_id  uuid not null references profiles(id) on delete cascade,
  book_id    uuid references books(id) on delete set null,
  circle_id  uuid,   -- null = global feed
  body       text not null,
  image_url  text,
  likes      uuid[] not null default '{}',
  at         timestamptz not null default now()
);

-- ============================================================================
-- COMMENTS
-- ============================================================================
create table if not exists comments (
  id        uuid primary key default uuid_generate_v4(),
  post_id   uuid not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body      text not null,
  at        timestamptz not null default now()
);

-- ============================================================================
-- FOLLOWS
-- ============================================================================
create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followee_id uuid not null references profiles(id) on delete cascade,
  at          timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- ============================================================================
-- CIRCLES  (reading groups)
-- ============================================================================
create table if not exists circles (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  book_id    uuid references books(id) on delete set null,
  creator_id uuid not null references profiles(id) on delete cascade,
  private    bool not null default false,
  created_at timestamptz not null default now()
);

create table if not exists circle_members (
  circle_id uuid not null references circles(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

-- ============================================================================
-- AUTHOR ↔ READER THREADS  (private conversations per book)
-- ============================================================================
create table if not exists threads (
  id             uuid primary key default uuid_generate_v4(),
  book_id        uuid not null references books(id) on delete cascade,
  reader_id      uuid not null references profiles(id) on delete cascade,
  author_user_id uuid not null references profiles(id) on delete cascade,
  subject        text not null,
  rating         int check (rating between 1 and 5),
  liked          text,
  improve        text,
  updated_at     timestamptz not null default now(),
  unique (book_id, reader_id)  -- one thread per book per reader
);

create table if not exists thread_messages (
  id         uuid primary key default uuid_generate_v4(),
  thread_id  uuid not null references threads(id) on delete cascade,
  from_role  text not null check (from_role in ('reader','author')),
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null,
  at         timestamptz not null default now()
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
create table if not exists notifications (
  id           uuid primary key default uuid_generate_v4(),
  to_user_id   uuid not null references profiles(id) on delete cascade,
  type         text not null,   -- 'follow','like','comment','reply','invite','drop'
  from_user_id uuid references profiles(id) on delete set null,
  ref_id       uuid,            -- post_id, thread_id, book_id etc.
  read         bool not null default false,
  at           timestamptz not null default now()
);

create index if not exists notifs_user_idx on notifications(to_user_id, at desc);

-- ============================================================================
-- SHELF  (books a reader has claimed)
-- ============================================================================
create table if not exists shelf (
  user_id    uuid not null references profiles(id) on delete cascade,
  book_id    uuid not null references books(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- ============================================================================
-- PUSH SUBSCRIPTIONS
-- ============================================================================
create table if not exists push_subscriptions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- STORED PROCEDURES / RPC  (called from the frontend JS)
-- ============================================================================

-- Atomically claim a founding-member spot.
-- Returns: { claimed: bool, founder_no: int | null }
create or replace function claim_founder_spot()
returns jsonb language plpgsql security definer as $$
declare
  v_count int;
  v_cap   int;
  v_no    int;
begin
  select founder_count, founding_cap into v_count, v_cap from settings;
  if v_count >= v_cap then
    return jsonb_build_object('claimed', false, 'founder_no', null);
  end if;
  update settings set founder_count = founder_count + 1
    where id = true
    returning founder_count into v_no;
  return jsonb_build_object('claimed', true, 'founder_no', v_no);
end;
$$;

-- Credit a referrer when someone signs up with their invite code.
-- Increments invites count and sets charter = true at 5.
create or replace function credit_referrer(p_invite_code text, p_new_user_id uuid)
returns void language plpgsql security definer as $$
declare v_ref_id uuid;
begin
  select id into v_ref_id from profiles where invite_code = p_invite_code;
  if v_ref_id is null then return; end if;
  update profiles
     set invites = invites + 1,
         charter = (invites + 1) >= 5
   where id = v_ref_id;
  insert into notifications(to_user_id, type, from_user_id, ref_id)
    values (v_ref_id, 'invite', p_new_user_id, null);
end;
$$;

-- Toggle a like on a post (idempotent array add/remove).
create or replace function toggle_like(p_post_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  if (select p_user_id = any(likes) from posts where id = p_post_id) then
    update posts set likes = array_remove(likes, p_user_id) where id = p_post_id;
  else
    update posts set likes = array_append(likes, p_user_id) where id = p_post_id;
    insert into notifications(to_user_id, type, from_user_id, ref_id)
      select author_id, 'like', p_user_id, p_post_id
        from posts where id = p_post_id
          and author_id <> p_user_id;
  end if;
end;
$$;

-- ============================================================================
-- REALTIME  (enable for live feed + notifications)
-- ============================================================================
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'posts'
  ) then alter publication supabase_realtime add table posts; end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'comments'
  ) then alter publication supabase_realtime add table comments; end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then alter publication supabase_realtime add table notifications; end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'follows'
  ) then alter publication supabase_realtime add table follows; end if;
end $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table profiles           enable row level security;
alter table books              enable row level security;
alter table posts              enable row level security;
alter table comments           enable row level security;
alter table follows            enable row level security;
alter table circles            enable row level security;
alter table circle_members     enable row level security;
alter table threads            enable row level security;
alter table thread_messages    enable row level security;
alter table notifications      enable row level security;
alter table shelf              enable row level security;
alter table push_subscriptions enable row level security;
alter table settings           enable row level security;

-- ── settings ─────────────────────────────────────────────────────────────────
create policy "Settings readable by all"
  on settings for select using (true);
create policy "Settings editable by admins only"
  on settings for update
  using (exists (select 1 from profiles where id = auth.uid() and admin = true));

-- ── profiles ─────────────────────────────────────────────────────────────────
create policy "Profiles readable by all"
  on profiles for select using (true);
create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);
create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- ── books ────────────────────────────────────────────────────────────────────
create policy "Approved books readable by all"
  on books for select
  using (status = 'approved' or author_user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and admin = true));
create policy "Authors can insert books"
  on books for insert
  with check (auth.uid() = author_user_id
    and exists (select 1 from profiles where id = auth.uid() and role = 'author'));
create policy "Authors can update their own books"
  on books for update
  using (auth.uid() = author_user_id
    or exists (select 1 from profiles where id = auth.uid() and admin = true));

-- ── posts ────────────────────────────────────────────────────────────────────
create policy "Posts readable by all authenticated users"
  on posts for select using (auth.uid() is not null);
create policy "Authenticated users can create posts"
  on posts for insert with check (auth.uid() = author_id);
create policy "Authors can update their own posts"
  on posts for update using (auth.uid() = author_id);
create policy "Authors can delete their own posts"
  on posts for delete using (auth.uid() = author_id
    or exists (select 1 from profiles where id = auth.uid() and admin = true));

-- ── comments ─────────────────────────────────────────────────────────────────
create policy "Comments readable by authenticated users"
  on comments for select using (auth.uid() is not null);
create policy "Authenticated users can comment"
  on comments for insert with check (auth.uid() = author_id);
create policy "Users can delete own comments"
  on comments for delete using (auth.uid() = author_id
    or exists (select 1 from profiles where id = auth.uid() and admin = true));

-- ── follows ──────────────────────────────────────────────────────────────────
create policy "Follows readable by all authenticated users"
  on follows for select using (auth.uid() is not null);
create policy "Users can follow"
  on follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow"
  on follows for delete using (auth.uid() = follower_id);

-- ── circles ──────────────────────────────────────────────────────────────────
create policy "Public circles readable by all authenticated"
  on circles for select
  using (auth.uid() is not null and (
    private = false
    or creator_id = auth.uid()
    or exists (select 1 from circle_members where circle_id = id and user_id = auth.uid())
  ));
create policy "Authenticated users can create circles"
  on circles for insert with check (auth.uid() = creator_id);
create policy "Creators can update their circles"
  on circles for update using (auth.uid() = creator_id);

-- ── circle_members ────────────────────────────────────────────────────────────
create policy "Members readable by circle members"
  on circle_members for select using (
    exists (select 1 from circle_members cm where cm.circle_id = circle_id and cm.user_id = auth.uid())
    or exists (select 1 from circles c where c.id = circle_id and c.creator_id = auth.uid())
  );
create policy "Users can join circles"
  on circle_members for insert with check (auth.uid() = user_id);
create policy "Users can leave circles"
  on circle_members for delete using (auth.uid() = user_id);

-- ── threads ──────────────────────────────────────────────────────────────────
create policy "Threads visible to reader and author only"
  on threads for select
  using (auth.uid() = reader_id or auth.uid() = author_user_id
    or exists (select 1 from profiles where id = auth.uid() and admin = true));
create policy "Readers can start threads"
  on threads for insert with check (auth.uid() = reader_id);
create policy "Participants can update threads (rating/feedback)"
  on threads for update
  using (auth.uid() = reader_id or auth.uid() = author_user_id);

-- ── thread_messages ───────────────────────────────────────────────────────────
create policy "Thread messages visible to participants"
  on thread_messages for select
  using (exists (
    select 1 from threads t where t.id = thread_id
    and (t.reader_id = auth.uid() or t.author_user_id = auth.uid())
  ));
create policy "Participants can send messages"
  on thread_messages for insert
  with check (auth.uid() = user_id and exists (
    select 1 from threads t where t.id = thread_id
    and (t.reader_id = auth.uid() or t.author_user_id = auth.uid())
  ));

-- ── notifications ─────────────────────────────────────────────────────────────
create policy "Users see their own notifications"
  on notifications for select using (auth.uid() = to_user_id);
create policy "System can insert notifications via RPC"
  on notifications for insert with check (true);  -- controlled by security definer RPCs
create policy "Users can mark own notifications read"
  on notifications for update using (auth.uid() = to_user_id);

-- ── shelf ─────────────────────────────────────────────────────────────────────
create policy "Users see their own shelf"
  on shelf for select using (auth.uid() = user_id);
create policy "Users can claim books"
  on shelf for insert with check (auth.uid() = user_id);

-- ── push_subscriptions ────────────────────────────────────────────────────────
create policy "Users manage their own push subs"
  on push_subscriptions for all using (auth.uid() = user_id);

-- ============================================================================
-- STORAGE BUCKETS  (run separately or via dashboard)
-- ============================================================================
-- insert into storage.buckets (id, name, public) values ('covers', 'covers', true);
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
--
-- create policy "Anyone can view covers"
--   on storage.objects for select using (bucket_id = 'covers');
-- create policy "Authors can upload covers"
--   on storage.objects for insert
--   with check (bucket_id = 'covers' and auth.uid() is not null);
-- create policy "Anyone can view avatars"
--   on storage.objects for select using (bucket_id = 'avatars');
-- create policy "Users upload their own avatar"
--   on storage.objects for insert
--   with check (bucket_id = 'avatars' and auth.uid() is not null);
