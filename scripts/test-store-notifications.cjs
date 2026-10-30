// Optional: temporarily install @electric-sql/pglite to run this SQL regression.
const path=require('node:path');const root=path.resolve(__dirname,'..');
const { PGlite }=require('@electric-sql/pglite');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{const db=new PGlite();await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select null::uuid $$;");
const base=fs.readFileSync(path.join(root,'scripts/024_wallet_notifications.sql'),'utf8');await db.exec(base.slice(base.indexOf('create table if not exists public.notifications')));
await db.exec(fs.readFileSync(path.join(root,'scripts/069_notification_email_delivery.sql'),'utf8'));
const migration=fs.readFileSync(path.join(root,'scripts/070_store_launch_notifications.sql'),'utf8');await db.exec(migration);await db.exec(migration);
const a='11111111-1111-1111-1111-111111111111',b='22222222-2222-2222-2222-222222222222';await db.exec(`insert into auth.users values('${a}'),('${b}')`);
await db.query('select set_store_launch_subscription($1,true)',[a]);await db.query('select set_store_launch_subscription($1,true)',[a]);assert.equal((await db.query('select * from store_launch_subscriptions')).rows.length,1);
await db.query('select set_store_launch_subscription($1,true)',[b]);await db.query('select set_store_launch_subscription($1,false)',[b]);
await db.query('insert into notification_preferences(user_id,email_enabled) values($1,false)',[a]);
assert.equal((await db.query("select announce_store_launch('/store') as count")).rows[0].count,1);assert.equal((await db.query("select announce_store_launch('/store') as count")).rows[0].count,0);
assert.equal((await db.query('select * from notification_email_outbox')).rows.length,1);
await db.query('select set_store_launch_subscription($1,false)',[a]);assert.equal((await db.query("select notification_email_allowed($1,'system','{\"kind\":\"store_launch\"}') as allowed",[a])).rows[0].allowed,false);
assert.equal((await db.query("select has_function_privilege('authenticated','announce_store_launch(text)','EXECUTE') as allowed")).rows[0].allowed,false);
assert.equal((await db.query("select has_table_privilege('authenticated','store_launch_subscriptions','INSERT') as allowed")).rows[0].allowed,false);
await assert.rejects(db.query("select announce_store_launch('//evil.example')"));await db.close();console.log('PASS: Store migration twice, duplicate signup, opt-out, launch-only queueing, one announcement per account, cancelling queued delivery, service-only mutations and launch.');
})().catch(e=>{console.error(e);process.exit(1)});
