-- Anyone who signed up before the handle_new_user trigger existed has an
-- auth.users row but no profile, and plans.created_by references profiles(id)
-- — so creating a plan fails on the foreign key with a confusing error.
--
-- Backfill them, and make the app's own recovery path cheap: profile_self()
-- is idempotent, so the client can call it whenever it finds itself signed in
-- without a profile, whatever the cause.

insert into profiles (id, email, display_name, auth_provider)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(
    u.raw_user_meta_data->>'full_name',
    split_part(coalesce(u.email, 'user'), '@', 1)
  ),
  case when u.raw_app_meta_data->>'provider' = 'google' then 'google' else 'password' end
from auth.users u
left join profiles p on p.id = u.id
where p.id is null;

/**
 * Ensure the signed-in user has a profile, and return it. Safe to call on
 * every launch: it does nothing when the row already exists.
 */
create function ensure_profile()
returns profiles
language plpgsql security definer set search_path = public as $fn$
declare
  v_profile profiles;
  v_user auth.users;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into v_profile from profiles where id = auth.uid();
  if found then
    return v_profile;
  end if;

  select * into v_user from auth.users where id = auth.uid();
  insert into profiles (id, email, display_name, auth_provider)
  values (
    v_user.id,
    coalesce(v_user.email, ''),
    coalesce(
      v_user.raw_user_meta_data->>'full_name',
      split_part(coalesce(v_user.email, 'user'), '@', 1)
    ),
    case when v_user.raw_app_meta_data->>'provider' = 'google' then 'google' else 'password' end
  )
  returning * into v_profile;

  return v_profile;
end $fn$;

grant execute on function ensure_profile() to authenticated;
