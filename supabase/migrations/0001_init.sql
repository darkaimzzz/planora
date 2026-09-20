-- PlanBot core schema (PRD §8) + RLS.
-- Everything is scoped to plan attendance: if you're an attendee you can read
-- the plan and write your own rows; otherwise you see nothing.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles

create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text        not null,
  display_name  text        not null,
  avatar_color  text        not null default '#6366f1',
  auth_provider text        not null default 'password'
                            check (auth_provider in ('password','google')),
  -- false until the user picks a display name + colour on first login
  onboarded     boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- Row is created on signup by trigger; display name and colour are confirmed
-- at first login, which flips onboarded to true.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  insert into profiles (id, email, display_name, auth_provider)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    case when new.raw_app_meta_data->>'provider' = 'google'
         then 'google' else 'password' end
  )
  on conflict (id) do nothing;
  return new;
end $fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------------- plans

create table plans (
  id           uuid primary key default gen_random_uuid(),
  title        text        not null,
  type         text        not null default 'hangout',
  created_by   uuid        not null references profiles(id) on delete cascade,
  status       text        not null default 'collecting'
                           check (status in ('collecting','voting','decided')),
  invite_token uuid        not null unique default gen_random_uuid(),
  -- filled once both polls resolve; drives the Home calendar
  confirmed_start timestamptz,
  confirmed_end   timestamptz,
  confirmed_venue text,
  created_at   timestamptz not null default now()
);

create table plan_attendees (
  id        uuid primary key default gen_random_uuid(),
  plan_id   uuid not null references plans(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (plan_id, user_id)
);
create index on plan_attendees (user_id);

-- SECURITY DEFINER so RLS policies can call it without recursing into
-- plan_attendees' own policy.
create function is_attendee(p_plan_id uuid) returns boolean
language sql security definer stable set search_path = public as $fn$
  select exists (
    select 1 from plan_attendees
    where plan_id = p_plan_id and user_id = auth.uid()
  );
$fn$;

-- ------------------------------------------------------------ availability

create table availability (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  day        date not null,
  start_time time not null,
  end_time   time not null,
  check (end_time > start_time)
);
create index on availability (plan_id);

-- ------------------------------------------------------------------- polls

create table polls (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id) on delete cascade,
  poll_type  text not null check (poll_type in ('time','venue','adhoc')),
  status     text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  closed_at  timestamptz,
  -- 24h hard cap (PRD §7.4); the closer job reads this
  deadline   timestamptz not null default now() + interval '24 hours',
  winning_option_id uuid
);
create index on polls (plan_id);
create index on polls (status, deadline);

create table poll_options (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references polls(id) on delete cascade,
  label       text not null,
  proposed_by uuid references profiles(id) on delete set null,
  -- set for time-slot options; null for venue/adhoc
  starts_at   timestamptz,
  ends_at     timestamptz,
  -- how many attendees marked themselves free for this slot (tie-break rule)
  availability_count int not null default 0
);
create index on poll_options (poll_id);

alter table polls
  add constraint polls_winning_option_fk
  foreign key (winning_option_id) references poll_options(id) on delete set null;

create table votes (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references polls(id) on delete cascade,
  option_id  uuid not null references poll_options(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)   -- one vote each; changing your vote is an update
);
create index on votes (poll_id);

-- ---------------------------------------------------------------- messages

create table messages (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id) on delete cascade,
  user_id    uuid references profiles(id) on delete set null,  -- null = system/AI
  content    text not null,
  created_at timestamptz not null default now()
);
create index on messages (plan_id, created_at);

-- --------------------------------------------------------------------- RLS

alter table profiles       enable row level security;
alter table plans          enable row level security;
alter table plan_attendees enable row level security;
alter table availability   enable row level security;
alter table polls          enable row level security;
alter table poll_options   enable row level security;
alter table votes          enable row level security;
alter table messages       enable row level security;

-- Profiles are readable by any signed-in user (needed for attendee search),
-- writable only by their owner.
create policy profiles_read  on profiles for select to authenticated using (true);
create policy profiles_write on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy plans_read on plans for select to authenticated
  using (is_attendee(id) or created_by = auth.uid());
create policy plans_insert on plans for insert to authenticated
  with check (created_by = auth.uid());
-- Creator may edit title/type only (PRD §9, organizer power). Everything else
-- is frozen for the client; the vote flow writes it with the secret key.
create policy plans_update on plans for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create function freeze_plan_decision_columns() returns trigger
language plpgsql as $fn$
begin
  if auth.uid() is not null and (
       new.status          is distinct from old.status
    or new.confirmed_start is distinct from old.confirmed_start
    or new.confirmed_end   is distinct from old.confirmed_end
    or new.confirmed_venue is distinct from old.confirmed_venue
    or new.created_by      is distinct from old.created_by
    or new.invite_token    is distinct from old.invite_token
  ) then
    raise exception 'only title and type are editable; everything else is vote-governed';
  end if;
  return new;
end $fn$;

-- auth.uid() is null for the secret key / Edge Functions, so the vote flow
-- passes through while any signed-in client is held to title+type.
create trigger plans_freeze_decisions
  before update on plans
  for each row execute function freeze_plan_decision_columns();

create policy attendees_read on plan_attendees for select to authenticated
  using (is_attendee(plan_id));
-- You may add yourself; the creator may add others.
create policy attendees_insert on plan_attendees for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (select 1 from plans p where p.id = plan_id and p.created_by = auth.uid())
  );

create policy availability_read on availability for select to authenticated
  using (is_attendee(plan_id));
create policy availability_write on availability for all to authenticated
  using (user_id = auth.uid() and is_attendee(plan_id))
  with check (user_id = auth.uid() and is_attendee(plan_id));

create policy polls_read   on polls        for select to authenticated using (is_attendee(plan_id));
create policy options_read on poll_options for select to authenticated
  using (exists (select 1 from polls p where p.id = poll_id and is_attendee(p.plan_id)));

create policy votes_read on votes for select to authenticated
  using (exists (select 1 from polls p where p.id = poll_id and is_attendee(p.plan_id)));
-- Vote only as yourself, only in an open poll you attend.
create policy votes_write on votes for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from polls p
      where p.id = poll_id and p.status = 'open' and is_attendee(p.plan_id)
    )
  );

create policy messages_read on messages for select to authenticated
  using (is_attendee(plan_id));
create policy messages_insert on messages for insert to authenticated
  with check (user_id = auth.uid() and is_attendee(plan_id));

-- Polls, options and system messages are written by Edge Functions with the
-- secret key, which bypasses RLS. No client insert policy on purpose.

-- ------------------------------------------------------------------ invite

-- Peek at a plan from an invite link before joining (no attendance required).
create function plan_preview(p_token uuid)
returns table (id uuid, title text, type text, attendee_count bigint)
language sql security definer stable set search_path = public as $fn$
  select p.id, p.title, p.type,
         (select count(*) from plan_attendees a where a.plan_id = p.id)
  from plans p where p.invite_token = p_token;
$fn$;

-- Join via invite link. Idempotent: re-tapping the link is a no-op.
create function join_plan_by_token(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public as $fn$
declare v_plan_id uuid;
begin
  select id into v_plan_id from plans where invite_token = p_token;
  if v_plan_id is null then
    raise exception 'invalid invite token';
  end if;
  insert into plan_attendees (plan_id, user_id)
  values (v_plan_id, auth.uid())
  on conflict (plan_id, user_id) do nothing;
  return v_plan_id;
end $fn$;

grant execute on function plan_preview(uuid), join_plan_by_token(uuid) to authenticated;

-- Creator attends their own plan from the start.
create function add_creator_as_attendee() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  insert into plan_attendees (plan_id, user_id) values (new.id, new.created_by)
  on conflict do nothing;
  return new;
end $fn$;

create trigger plans_add_creator
  after insert on plans
  for each row execute function add_creator_as_attendee();

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table polls;
alter publication supabase_realtime add table poll_options;
alter publication supabase_realtime add table plan_attendees;
