-- votes_write was `for all`, so it also governed SELECT and overlapped
-- votes_read: two permissive policies evaluated on every read of a vote, and
-- a reader had to satisfy the stricter one for no reason. Reading votes is
-- votes_read's job; writing is this one's.

drop policy votes_write on votes;

create policy votes_cast on votes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from polls p
      where p.id = poll_id and p.status = 'open' and is_attendee(p.plan_id)
    )
  );

create policy votes_change on votes for update to authenticated
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

create policy votes_withdraw on votes for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from polls p where p.id = poll_id and p.status = 'open')
  );
