-- In-app account deletion. Both stores require it: Apple guideline 5.1.1(v),
-- and Google Play's data deletion policy.
--
-- What goes, and why:
--   · the auth user — everything else cascades from it
--   · profile, attendance, availability, votes — all FK'd with ON DELETE CASCADE
--   · plans they created — cascade from profiles, which also takes that plan's
--     polls, options, votes and messages with it
--   · their chat messages — deleted explicitly, see below
--
-- messages.user_id is ON DELETE SET NULL, and a null author is how the app
-- marks the AI confirmation message. Left alone, a deleted person's chat
-- messages would reappear as system announcements. So they are removed first.

create function delete_own_account()
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'sign in to delete your account';
  end if;

  -- Before the cascade, or these become author-less "system" messages.
  delete from messages where user_id = v_user;

  -- Takes the profile, and through it every plan they created, plus their
  -- attendance, availability and votes elsewhere.
  delete from auth.users where id = v_user;
end $fn$;

grant execute on function delete_own_account() to authenticated;

/**
 * What deleting the account will destroy for other people.
 *
 * Deleting a creator deletes their plans for everyone in them, so the app
 * shows this before asking for confirmation rather than springing it.
 */
create function account_deletion_impact()
returns table (plans_created bigint, plans_joined bigint, messages_sent bigint)
language sql security definer stable set search_path = public as $fn$
  select
    (select count(*) from plans where created_by = auth.uid()),
    (select count(*) from plan_attendees a
       join plans p on p.id = a.plan_id
      where a.user_id = auth.uid() and p.created_by <> auth.uid()),
    (select count(*) from messages where user_id = auth.uid());
$fn$;

grant execute on function account_deletion_impact() to authenticated;
