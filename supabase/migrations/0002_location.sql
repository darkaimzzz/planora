-- The venue is no longer voted on: the creator picks one place for the plan
-- (Google Places when a key is configured, free text otherwise). The time poll
-- is still a vote. This replaces the venue-poll stage of the flow.

alter table plans
  add column location_name    text,
  add column location_address text,
  add column location_place_id text,
  add column location_lat     double precision,
  add column location_lng     double precision;

-- confirmed_venue used to be written by the venue poll. It now mirrors the
-- chosen location name at confirmation time, so existing readers still work.

-- The freeze trigger previously allowed only title and type. Location is now
-- creator-editable too; everything genuinely vote-governed stays frozen.
create or replace function freeze_plan_decision_columns() returns trigger
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
    raise exception 'the confirmed time and status are decided by vote, not by edit';
  end if;

  -- Only the creator may set the location (RLS already limits updates to them,
  -- but this keeps the rule next to the other plan invariants).
  if auth.uid() is not null
     and auth.uid() <> old.created_by
     and (new.location_name is distinct from old.location_name
       or new.location_place_id is distinct from old.location_place_id) then
    raise exception 'only the plan creator can set the location';
  end if;

  return new;
end $fn$;

-- Venue polls are no longer created. Drop any that are still open so plans
-- mid-flight settle on the new path instead of waiting on a vote nobody can win.
delete from polls where poll_type = 'venue' and status = 'open';
