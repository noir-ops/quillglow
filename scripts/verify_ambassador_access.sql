-- Expected: all client privileges false, service_access true, RLS true.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
  r.role_name,
  has_table_privilege(r.role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as any_table_access,
  has_any_column_privilege(r.role_name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') as any_column_access,
  (has_table_privilege('service_role',c.oid,'SELECT')
   and has_table_privilege('service_role',c.oid,'INSERT')
   and has_table_privilege('service_role',c.oid,'UPDATE')
   and has_table_privilege('service_role',c.oid,'DELETE')) as service_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values ('anon'),('authenticated')) as r(role_name)
where n.nspname='public' and c.relname in ('ambassadors','ambassador_rewards','ambassador_certificates')
order by c.relname,r.role_name;
