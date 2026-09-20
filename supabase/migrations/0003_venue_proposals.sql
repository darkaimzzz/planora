-- Middle path for the venue: the creator proposes 2-3 real places (Google
-- Places when a key is configured), and those become the venue poll. The group
-- still decides; the creator only frames the choice.
--
-- The single-location path from 0002 stays as the fallback: if the creator sets
-- one place instead of proposing several, there is nothing to vote on and the
-- plan confirms with it.

-- Venue options carry the place data so the confirmed plan gets a real address
-- and map link, not just a label.
alter table poll_options
  add column place_name    text,
  add column place_address text,
  add column place_id      text,
  add column place_lat     double precision,
  add column place_lng     double precision;

/**
 * Creator-only: replace the venue options for a plan and open the poll.
 *
 * SECURITY DEFINER because clients deliberately have no insert policy on polls
 * or poll_options — this is the one sanctioned way for a person to create one.
 */
create function propose_venues(p_plan_id uuid, p_places jsonb)
returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  v_poll_id uuid;
  v_creator uuid;
  v_count int;
begin
  select created_by into v_creator from plans where id = p_plan_id;
  if v_creator is null then
    raise exception 'no such plan';
  end if;
  if v_creator <> auth.uid() then
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
    -- Changing the options after people have voted would silently discard
    -- their choices, so it is refused rather than handled.
    raise exception 'people have already voted; the options are locked';
  else
    delete from poll_options where poll_id = v_poll_id;
  end if;

  insert into poll_options (poll_id, label, proposed_by, place_name, place_address, place_id, place_lat, place_lng)
  select
    v_poll_id,
    coalesce(p->>'name', 'A place'),
    auth.uid(),
    p->>'name',
    p->>'address',
    p->>'placeId',
    (p->>'lat')::double precision,
    (p->>'lng')::double precision
  from jsonb_array_elements(p_places) as p;

  return v_poll_id;
end $fn$;

grant execute on function propose_venues(uuid, jsonb) to authenticated;
