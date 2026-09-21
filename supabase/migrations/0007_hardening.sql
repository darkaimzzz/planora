-- Hardening pass. Every item here is a defect that was reproduced against the
-- live project, not a precaution: see CLAUDE.md, 2026-09-22.
--
-- The theme running through most of them is that `auth.uid()` is NULL for an
-- anonymous caller, and NULL comparisons are NULL, not TRUE. A guard written as
-- `if x <> auth.uid() then raise` therefore lets anonymous callers straight
-- through. Anything that authorises by comparing against auth.uid() has to
-- reject a NULL uid first, explicitly.

-- ------------------------------------------------------------------ 1. anon
-- Postgres grants EXECUTE on a new function to PUBLIC by default, so naming
-- `authenticated` in a grant does not keep `anon` out. Lock every function
-- down and re-grant deliberately. plan_preview stays open: showing an invited
-- stranger which plan they were invited to is its whole job.

revoke execute on function is_attendee(uuid)                 from public;
revoke execute on function plan_preview(uuid)                from public;
revoke execute on function join_plan_by_token(uuid)          from public;
revoke execute on function propose_venues(uuid, jsonb)       from public;
revoke execute on function ensure_profile()                  from public;
revoke execute on function delete_own_account()              from public;
revoke execute on function account_deletion_impact()         from public;
revoke execute on function handle_new_user()                 from public;
revoke execute on function add_creator_as_attendee()         from public;
revoke execute on function freeze_plan_decision_columns()    from public;

grant execute on function is_attendee(uuid)                  to authenticated;
grant execute on function plan_preview(uuid)                 to anon, authenticated;
grant execute on function join_plan_by_token(uuid)           to authenticated;
grant execute on function propose_venues(uuid, jsonb)        to authenticated;
grant execute on function ensure_profile()                   to authenticated;
grant execute on function delete_own_account()               to authenticated;
grant execute on function account_deletion_impact()          to authenticated;

-- Belt and braces: even reachable, the guard now refuses a NULL caller.
create or replace function propose_venues(p_plan_id uuid, p_places jsonb)
returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  v_poll_id uuid;
  v_creator uuid;
  v_count int;
  v_caller uuid := auth.uid();
begin
  -- Must come first. `v_creator <> null` is null, not true, so without this
  -- an anonymous caller fell through the creator check entirely.
  if v_caller is null then
    raise exception 'sign in to propose places';
  end if;

  select created_by into v_creator from plans where id = p_plan_id;
  if v_creator is null then
    raise exception 'no such plan';
  end if;
  if v_creator <> v_caller then
    raise exception 'only the plan creator can propose venues';
  end if;

  v_count := jsonb_array_length(p_places);
  if v_count < 2 or v_count > 3 then
    raise exception 'propose two or three places, got %', v_count;
  end if;

  select id into v_poll_id from polls where plan_id = p_plan_id and poll_type = 'venue';

  if v_poll_id is null then
    insert into polls (plan_id, poll_type) values (p_plan_id, 'venue') returning id into v_poll_id;
  elsif exists (select 1 from polls where id = v_poll_id and status = 'closed') then
    raise exception 'the venue vote has already closed';
  elsif exists (select 1 from votes where poll_id = v_poll_id) then
    raise exception 'people have already voted; the options are locked';
  else
    delete from poll_options where poll_id = v_poll_id;
  end if;

  insert into poll_options (poll_id, label, proposed_by, place_name, place_address, place_id, place_lat, place_lng)
  select
    v_poll_id,
    coalesce(p->>'name', 'A place'),
    v_caller,
    p->>'name',
    p->>'address',
    p->>'placeId',
    (p->>'lat')::double precision,
    (p->>'lng')::double precision
  from jsonb_array_elements(p_places) as p;

  return v_poll_id;
end $fn$;

revoke execute on function propose_venues(uuid, jsonb) from public;
grant  execute on function propose_venues(uuid, jsonb) to authenticated;

-- --------------------------------------------------------------- 2. emails
-- profiles_read was `using (true)`, and email is a column, so any signed-in
-- user could select every address in the database in one request. Invite
-- search needs to *match* on email; it never needed to *return* it.
--
-- RLS is row-level, so the column is closed with column privileges instead:
-- drop the blanket SELECT and re-grant the columns that are safe to read.

revoke select on profiles from authenticated;
grant  select (id, display_name, avatar_color, auth_provider, onboarded, created_at)
  on profiles to authenticated;

-- Your own email is still yours to see; the app reads it from the session
-- (auth.users) rather than from this table.

/**
 * Find someone to invite by display name or email, without exposing either
 * address. Matching happens inside the function; only the public fields come
 * back out.
 */
create function search_people(p_query text)
returns table (id uuid, display_name text, avatar_color text)
language plpgsql security definer stable set search_path = public as $fn$
declare
  v_caller uuid := auth.uid();
  v_q text := trim(coalesce(p_query, ''));
begin
  if v_caller is null then
    raise exception 'sign in to search people';
  end if;
  -- Two characters minimum, so this can't be walked to dump the user table.
  if length(v_q) < 2 then
    return;
  end if;
  return query
    select p.id, p.display_name, p.avatar_color
    from profiles p
    where p.id <> v_caller
      and (p.display_name ilike '%' || v_q || '%' or p.email ilike '%' || v_q || '%')
    order by p.display_name
    limit 10;
end $fn$;

revoke execute on function search_people(text) from public;
grant  execute on function search_people(text) to authenticated;

-- ------------------------------------------------------- 3. duplicate polls
-- advance-plan reads "is there a poll?" then inserts one. Eight concurrent
-- calls produced up to eight time polls on a single plan, each with its own
-- options. The client fires advance-plan after every action, so two people
-- saving availability at the same moment is enough to hit it.
--
-- The database is the only place this can be settled. With the index, the
-- losing racers get a unique violation and back off.

delete from polls a
  using polls b
 where a.plan_id = b.plan_id
   and a.poll_type = b.poll_type
   and a.created_at > b.created_at;

create unique index polls_one_per_plan_and_type on polls (plan_id, poll_type);

-- ------------------------------------------------- 4. votes across polls
-- votes had independent foreign keys to polls and poll_options with nothing
-- tying them together, so a vote could point at an option belonging to a
-- different poll. Feed a venue option into the time poll and the winner has no
-- starts_at. A composite key makes the mismatch unrepresentable.

delete from votes v
 where not exists (
   select 1 from poll_options o where o.id = v.option_id and o.poll_id = v.poll_id
 );

alter table poll_options add constraint poll_options_id_within_poll unique (poll_id, id);
alter table votes
  add constraint votes_option_belongs_to_poll
  foreign key (poll_id, option_id) references poll_options (poll_id, id) on delete cascade;

-- Votes were deletable and changeable after the poll closed: the policy's
-- USING clause checked only ownership. Closing a poll now freezes its votes.
drop policy votes_write on votes;
create policy votes_write on votes for all to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from polls p where p.id = poll_id and p.status = 'open')
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from polls p
      where p.id = poll_id and p.status = 'open' and is_attendee(p.plan_id)
    )
  );

-- ------------------------------------------------------ 5. forged plans
-- The freeze trigger was BEFORE UPDATE only, so a client could INSERT a plan
-- that was already 'decided' with a fabricated time and venue, then invite
-- people to it. Decisions are made by vote; a new plan starts empty.

create function freeze_plan_decision_columns_on_insert() returns trigger
language plpgsql as $fn$
begin
  if auth.uid() is not null and (
       new.status <> 'collecting'
    or new.confirmed_start is not null
    or new.confirmed_end   is not null
    or new.confirmed_venue is not null
  ) then
    raise exception 'a new plan starts as collecting; the time and venue are decided by vote';
  end if;
  return new;
end $fn$;

create trigger plans_freeze_decisions_insert
  before insert on plans
  for each row execute function freeze_plan_decision_columns_on_insert();

-- ------------------------------------------- 6. location vs the venue vote
-- "Creator edits title/type only. No vote override, ever." (CLAUDE.md, locked.)
-- The creator could still PATCH location_name after the group's venue vote had
-- closed, quietly moving the plan somewhere nobody chose.
--
-- Setting one location directly is still allowed while there is nothing to
-- override: no venue poll, and not yet decided.

create or replace function freeze_plan_decision_columns() returns trigger
language plpgsql as $fn$
declare
  v_location_changed boolean := (
       new.location_name     is distinct from old.location_name
    or new.location_address  is distinct from old.location_address
    or new.location_place_id is distinct from old.location_place_id
    or new.location_lat      is distinct from old.location_lat
    or new.location_lng      is distinct from old.location_lng
  );
begin
  if auth.uid() is not null and (
       new.status          is distinct from old.status
    or new.confirmed_start is distinct from old.confirmed_start
    or new.confirmed_end   is distinct from old.confirmed_end
    or new.confirmed_venue is distinct from old.confirmed_venue
    or new.created_by      is distinct from old.created_by
    or new.invite_token    is distinct from old.invite_token
  ) then
    raise exception 'the confirmed time and status are decided by vote, not by edit';
  end if;

  if auth.uid() is not null and v_location_changed then
    if auth.uid() <> old.created_by then
      raise exception 'only the plan creator can set the location';
    end if;
    if old.status = 'decided' then
      raise exception 'the plan is confirmed; the location is settled';
    end if;
    if exists (select 1 from polls p where p.plan_id = old.id and p.poll_type = 'venue') then
      raise exception 'the group is voting on the venue; the location follows the vote';
    end if;
  end if;

  return new;
end $fn$;

-- --------------------------------------------------------------- 7. the cap
-- "Jev early-close + hard 24h auto-close fallback. Fallback always wins."
-- (CLAUDE.md, locked.) Nothing was scheduled, so the cap only ever fired when
-- somebody happened to open the app. Every quarter of an hour, sweep.
--
-- The publishable key is the one that ships in the app bundle and the landing
-- page; it is public by design. advance-plan resolves its own authority from
-- the service role inside the function.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('planora-advance-sweep')
 where exists (select 1 from cron.job where jobname = 'planora-advance-sweep');

select cron.schedule(
  'planora-advance-sweep',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url     := 'https://tnjgqoznxgeymipbxqqs.supabase.co/functions/v1/advance-plan',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_Vfe6fcgpkb6cHWfY3XIxmA_JKODoxfB'
      ),
      body    := '{}'::jsonb
    );
  $cron$
);
