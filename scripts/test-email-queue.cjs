// Optional SQL tests: install @electric-sql/pglite without saving it to package.json.
const path = require('node:path'); const root = path.resolve(__dirname, '..');
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const assert = require('node:assert/strict');
(async () => {
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
 const base = fs.readFileSync(path.join(root,'scripts/024_wallet_notifications.sql'),'utf8');
 await db.exec(base.slice(base.indexOf('create table if not exists public.notifications')));
 const migration = fs.readFileSync(path.join(root,'scripts/069_notification_email_delivery.sql'),'utf8');
 await db.exec(migration); await db.exec(migration);
 const u = '11111111-1111-1111-1111-111111111111';
 await db.exec(`insert into auth.users values('${u}');`);
 const notify = async (category, metadata = '{}') => db.query(`select public.send_notification($1,$2,'Title','Body','/wallet','in_app',$3::jsonb)`,[u,category,metadata]);
 await notify('scholarship');
 let q = await db.query('select * from notification_email_outbox'); assert.equal(q.rows.length,1);
 await notify('marketplace'); assert.equal((await db.query('select * from notification_email_outbox')).rows.length,1);
 await notify('learning', '{"kind":"weekly_report"}'); assert.equal((await db.query('select * from notification_email_outbox')).rows.length,1);
 await db.query('insert into notification_preferences(user_id,email_enabled) values($1,false)',[u]);
 await notify('scholarship'); assert.equal((await db.query('select * from notification_email_outbox')).rows.length,1);
 assert.equal((await db.query('select * from notifications')).rows.length,4); // in-app remains available after email opt-out
 await db.query('update notification_preferences set email_enabled=true,study_reminders=false where user_id=$1',[u]);
 await notify('learning', '{"kind":"study_reminder"}'); assert.equal((await db.query('select * from notification_email_outbox')).rows.length,1);
 await db.query('update notification_preferences set weekly_report=true where user_id=$1',[u]);
 await notify('learning', '{"kind":"weekly_report"}'); assert.equal((await db.query('select * from notification_email_outbox')).rows.length,2);
 const claimed = await db.query('select * from claim_notification_emails(1,null)'); assert.equal(claimed.rows.length,1); assert.equal(claimed.rows[0].attempts,1); assert.ok(claimed.rows[0].lock_token);
 const other = await db.query('select * from claim_notification_emails(20,null)'); assert.equal(other.rows.length,1); assert.notEqual(other.rows[0].id,claimed.rows[0].id);
 assert.equal((await db.query('select * from claim_notification_emails(20,null)')).rows.length,0);
 await db.exec("update notification_email_outbox set locked_at=now()-interval '11 minutes'");
 assert.equal((await db.query('select * from claim_notification_emails(20,null)')).rows.length,2);
 assert.equal((await db.query("select has_table_privilege('authenticated','notification_email_outbox','SELECT') as allowed")).rows[0].allowed,false);
 assert.equal((await db.query("select has_function_privilege('authenticated','claim_notification_emails(int,uuid)','EXECUTE') as allowed")).rows[0].allowed,false);
 await db.close(); console.log('PASS: migration twice, automatic queue creation, category defaults, master opt-out, reminder/report opt-outs, in-app preservation, exclusive leases, stale lease recovery, service-role-only queue.');
})().catch(e => { console.error(e); process.exit(1) });
