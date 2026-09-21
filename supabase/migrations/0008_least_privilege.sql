-- Second hardening pass, driven by the platform's own advisors after 0007.
--
-- The headline: **the revokes in 0007 did not actually work.** Supabase sets
-- default privileges that GRANT EXECUTE on every new function in `public` to
-- anon, authenticated and service_role, so revoking from PUBLIC leaves the
-- explicit grant to `anon` in place. `has_function_privilege('anon', …)` was
-- still true for every function afterwards.
--
-- Nothing was exploitable — 0007 also made each function reject a NULL
-- auth.uid() itself, which is what the audit proves — but a function that
-- authorises correctly *and* is unreachable is the shape we want.

-- --------------------------------------------------- 1. actually revoke anon
revoke execute on function is_attendee(uuid)              from anon;
revoke execute on function join_plan_by_token(uuid)       from anon;
revoke execute on function propose_venues(uuid, jsonb)    from anon;
revoke execute on function search_people(text)            from anon;
revoke execute on function ensure_profile()               from anon;
revoke execute on function delete_own_account()           from anon;
revoke execute on function account_deletion_impact()      from anon;

-- Trigger functions are invoked by the trigger machinery, which does not check
-- EXECUTE on the caller, so removing these breaks nothing and takes three
-- RPC endpoints off the public surface.
-- `public` as well as the named roles: a role inherits PUBLIC's grant, so
-- revoking from anon alone leaves the function reachable. That is exactly the
-- mistake 0007 made in the other direction.
revoke execute on function handle_new_user()                        from public, anon, authenticated;
revoke execute on function add_creator_as_attendee()                from public, anon, authenticated;
revoke execute on function freeze_plan_decision_columns()           from public, anon, authenticated;
revoke execute on function freeze_plan_decision_columns_on_insert() from public, anon, authenticated;
revoke execute on function search_people(text)                      from public;

-- plan_preview stays anonymous on purpose: an invited stranger has to be able
-- to see which plan the link is for before signing up.

-- Stop the default privileges from re-opening this for anything added later.
alter default privileges in schema public revoke execute on functions from anon;

-- ------------------------------------------------------- 2. search_path
-- A SECURITY DEFINER function with a mutable search_path can be steered at a
-- different schema's objects. The definer functions already pin it; these two
-- triggers did not.
alter function freeze_plan_decision_columns()          set search_path = public;
alter function freeze_plan_decision_columns_on_insert() set search_path = public;

-- --------------------------------------------------------- 3. pg_net home
-- Extensions do not belong in `public`, where their functions sit alongside
-- the app's on the exposed API surface.
drop extension if exists pg_net;
create extension pg_net with schema extensions;

select cron.unschedule('planora-advance-sweep')
 where exists (select 1 from cron.job where jobname = 'planora-advance-sweep');

select cron.schedule(
  'planora-advance-sweep',
  '*/15 * * * *',
  $cron$
    select extensions.net.http_post(
      url     := 'https://tnjgqoznxgeymipbxqqs.supabase.co/functions/v1/advance-plan',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_Vfe6fcgpkb6cHWfY3XIxmA_JKODoxfB'
      ),
      body    := '{}'::jsonb
    );
  $cron$
);

-- ------------------------------------------------------ 4. policy initplan
-- `auth.uid()` in a policy is re-evaluated per row. Wrapping it in a scalar
-- subquery makes Postgres treat it as a one-off InitPlan. Same rules, same
-- results — this is purely how often the function runs.

drop policy profiles_write on profiles;
create policy profiles_write on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy plans_read on plans;
create policy plans_read on plans for select to authenticated
  using (is_attendee(id) or created_by = (select auth.uid()));

drop policy plans_insert on plans;
create policy plans_insert on plans for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy plans_update on plans;
create policy plans_update on plans for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

drop policy attendees_insert on plan_attendees;
create policy attendees_insert on plan_attendees for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or exists (select 1 from plans p where p.id = plan_id and p.created_by = (select auth.uid()))
  );

drop policy availability_write on availability;
create policy availability_write on availability for all to authenticated
  using (user_id = (select auth.uid()) and is_attendee(plan_id))
  with check (user_id = (select auth.uid()) and is_attendee(plan_id));

drop policy votes_write on votes;
create policy votes_write on votes for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from polls p where p.id = poll_id and p.status = 'open')
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from polls p
      where p.id = poll_id and p.status = 'open' and is_attendee(p.plan_id)
    )
  );

drop policy messages_insert on messages;
create policy messages_insert on messages for insert to authenticated
  with check (user_id = (select auth.uid()) and is_attendee(plan_id));

-- ------------------------------------------------------ 5. foreign keys
-- Every one of these is joined or filtered on in the app; none had a covering
-- index, so each was a sequential scan waiting to matter.
create index if not exists availability_user_id_idx    on availability (user_id);
create index if not exists messages_user_id_idx        on messages (user_id);
create index if not exists plans_created_by_idx        on plans (created_by);
create index if not exists poll_options_proposed_by_idx on poll_options (proposed_by);
create index if not exists polls_winning_option_idx    on polls (winning_option_id);
create index if not exists votes_option_id_idx         on votes (option_id);
create index if not exists votes_user_id_idx           on votes (user_id);
create index if not exists votes_poll_option_idx       on votes (poll_id, option_id);
