-- Make yourself an admin (run once, AFTER creating your user in
-- Authentication → Users). Replace the email with yours, then Run.
insert into public.admins (user_id)
select id from auth.users where email = 'YOUR-EMAIL@example.com'
on conflict do nothing;
