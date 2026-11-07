-- Deliver role-addressed private messages without exposing them to other roles.
-- Student accounts may receive student messages immediately; staff, company and
-- agency accounts require an approved role profile before receiving messages.

drop policy if exists "role recipients read private messages" on public.program_role_messages;
create policy "role recipients read private messages"
  on public.program_role_messages for select to authenticated
  using (
    exists (
      select 1
      from public.program_user_profiles profile
      where profile.user_id = auth.uid()
        and profile.requested_role = program_role_messages.recipient_role
        and (profile.requested_role = 'student' or profile.approval_status = 'approved')
    )
  );

drop policy if exists "role recipients update private messages" on public.program_role_messages;
create policy "role recipients update private messages"
  on public.program_role_messages for update to authenticated
  using (
    exists (
      select 1
      from public.program_user_profiles profile
      where profile.user_id = auth.uid()
        and profile.requested_role = program_role_messages.recipient_role
        and (profile.requested_role = 'student' or profile.approval_status = 'approved')
    )
  )
  with check (
    exists (
      select 1
      from public.program_user_profiles profile
      where profile.user_id = auth.uid()
        and profile.requested_role = program_role_messages.recipient_role
        and (profile.requested_role = 'student' or profile.approval_status = 'approved')
    )
  );
