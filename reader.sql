-- Run once in the Supabase SQL editor, after schema.sql. Creates the read-only
-- login the website uses, so the site never holds a password that can change
-- data. Replace the password first.

create role fd_reader with login password 'replace-with-a-long-random-password';

grant usage on schema public to fd_reader;
grant select on filings, analyses to fd_reader;

-- Row-level security is on with no policies, which hides every row from roles
-- other than the tables' owner. Let this role read them.
create policy "fd_reader reads filings" on filings
    for select to fd_reader using (true);
create policy "fd_reader reads analyses" on analyses
    for select to fd_reader using (true);
