-- The invite landing page is a static page with no session, but it should
-- still be able to say *which* plan you've been invited to rather than being
-- an anonymous wall.
--
-- plan_preview returns only a title, type and headcount, and only for an exact
-- invite token, an unguessable UUID that the holder of the link is already
-- meant to have. That is the same thing join_plan_by_token would reveal a
-- moment later, so granting it to anonymous visitors exposes nothing new.
-- join_plan_by_token deliberately stays authenticated-only: reading who you're
-- invited by is public, actually joining is not.

grant execute on function plan_preview(uuid) to anon;

-- Anonymous joins already fail, but on a NOT NULL violation deep in the
-- insert, which surfaces as a confusing constraint error. Say what's wrong.
create or replace function join_plan_by_token(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public as $fn$
declare v_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in to join a plan';
  end if;

  select id into v_plan_id from plans where invite_token = p_token;
  if v_plan_id is null then
    raise exception 'invalid invite token';
  end if;

  insert into plan_attendees (plan_id, user_id)
  values (v_plan_id, auth.uid())
  on conflict (plan_id, user_id) do nothing;
  return v_plan_id;
end $fn$;
