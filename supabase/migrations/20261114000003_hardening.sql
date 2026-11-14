-- Security advisor fixes: trigger functions must not be callable over the REST API,
-- and pg_net belongs in the extensions schema.
revoke execute on function public.enforce_limits() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop extension if exists pg_net;
create extension pg_net schema extensions;
