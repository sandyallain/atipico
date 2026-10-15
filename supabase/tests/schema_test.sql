-- Sur un Postgres local vide, depuis supabase/tests : createdb t && psql -d t -f schema_test.sql
create role authenticated; create role anon;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
\i ../migrations/0001_init.sql
grant all on all tables in schema public to authenticated;
revoke update on messages from authenticated; grant update (read_at) on messages to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-00000000000c');
insert into profiles(id,pseudo,birth_date,city,consent_at) values
 ('00000000-0000-0000-0000-00000000000a','ana','1990-01-01','Madrid',now()),
 ('00000000-0000-0000-0000-00000000000b','ben','1990-01-01','Madrid',now()),
 ('00000000-0000-0000-0000-00000000000c','cel','1990-01-01','Madrid',now());
insert into events(id,creator_id,title,description,city,start_at,capacity) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-00000000000a','Paseo Retiro','x','Madrid',now()+interval '2 days',2);
set role authenticated;
set request.uid='00000000-0000-0000-0000-00000000000a'; select join_event('00000000-0000-0000-0000-0000000000e1') as a;
set request.uid='00000000-0000-0000-0000-00000000000b'; select join_event('00000000-0000-0000-0000-0000000000e1') as b;
set request.uid='00000000-0000-0000-0000-00000000000c'; select join_event('00000000-0000-0000-0000-0000000000e1') as c_waitlist;
-- c cannot message a (no link) 
do $$ begin insert into messages(sender_id,recipient_id,body) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000a','hola'); raise exception 'should fail'; exception when insufficient_privilege then raise notice 'ok: c blocked from messaging'; end $$;
set request.uid='00000000-0000-0000-0000-00000000000b'; select leave_event('00000000-0000-0000-0000-0000000000e1');
select profile_id, status from participations order by profile_id;
set request.uid='00000000-0000-0000-0000-00000000000c';
insert into messages(sender_id,recipient_id,body) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000a','hola, nos vemos el sábado');
select 'ok: c messages a after promotion' ;
-- under 18
reset role;
do $$ begin insert into auth.users values ('00000000-0000-0000-0000-00000000000d'); insert into profiles(id,pseudo,birth_date,city,consent_at) values ('00000000-0000-0000-0000-00000000000d','kid',current_date - interval '16 years','Madrid',now()); raise exception 'should fail'; exception when check_violation then raise notice 'ok: under 18 rejected'; end $$;
