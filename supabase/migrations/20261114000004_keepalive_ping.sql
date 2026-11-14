-- Harmless public RPC for the GitHub Actions keep-alive (a real DB query, no data exposed).
create or replace function public.ping()
returns int
language sql
stable
security invoker
set search_path = ''
as $$ select 1 $$;
revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
