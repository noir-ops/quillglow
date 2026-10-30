// Real route handlers, mocked provider/Supabase boundary. No external calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),adminRoot=path.resolve(root,'../quillglow_admin-main');
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
let user={id:uid,email:'student@example.test'},quotaMode='allow',providerStatus=200,modelCalls=0,rpcCalls=[],refunds=0,syncCalls=0,isAdmin=true,rows=[],seen=false,logError=false;
let checkout={status:'succeeded',subscription_id:'sub1',metadata:{user_id:uid}},snapshot={id:'sub1',product_id:'genius',status:'active',created_at:new Date().toISOString(),modified_at:new Date().toISOString(),current_period_end:new Date(Date.now()+86400000).toISOString(),metadata:{user_id:uid}};
let firstSnapshot=null,discoveryPages=0;
function query(table){let fields={};return {select(){return this},eq(k,v){fields[k]=v;return this},gte(){return this},order(){return this},limit(){return this},gt(k,v){fields.cursor=v;return this},or(){return this},insert(v){this.value=v;return this},update(){return this},delete(){return this},upsert(){return this},
 result(){if(table==='tasks')return {data:[{title:'Study physics',subject:'Physics',due_date:'2026-10-01',completed:false}],error:null};
 if(table==='polar_webhook_events')return {data:seen?{webhook_id:'event1'}:null,error:logError?{message:'offline'}:null};
 if(table==='flashcards')return {data:this.value||[],error:null};
 if(table==='subscriptions'){if(fields.polar_subscription_id||fields.polar_checkout_id||fields.polar_customer_id)return {data:null,error:null}; if(fields.user_id)return {data:{user_id:fields.user_id,polar_checkout_id:'checkout1'},error:null};return {data:rows.filter(r=>!fields.cursor||r.user_id>fields.cursor).slice(0,50),error:null};}return {data:[],error:null}},
 maybeSingle(){return Promise.resolve(this.result())},single(){return this.maybeSingle()},then(f){return Promise.resolve(this.result()).then(f)}}}
const client={auth:{getUser:async()=>({data:{user}})},from:query,rpc:async(name,args)=>{rpcCalls.push({name,args});if(name==='consume_ai_quota_v2')return quotaMode==='error'?{error:{message:'offline'}}:quotaMode==='empty'?{data:[]}:{data:[{allowed:quotaMode!=='deny',used:1,limit:5,remaining:4,plan:'scholar'}]};
 if(name==='refund_ai_quota'){refunds++;return {data:null}};if(name==='sync_polar_subscription'){syncCalls++;firstSnapshot||=args.p_snapshot;return {data:{outcome:'applied',userId:args.p_user_id}}};
 if(name==='claim_billing_job')return {data:{claimed:true,token:'token',cursor:null,page:1}};if(name==='finish_billing_job')return {data:null};if(name==='expire_genius_subscriptions')return {data:2};return {data:null}}};
function load(file,base=root){const full=path.join(base,file),mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function req(id){if(id==='next/server')return{NextResponse:{json:(data,o)=>new Response(JSON.stringify(data),{status:o?.status||200,headers:o?.headers})}};
if(id==='next/cache')return{revalidatePath(){}};
if(id==='@/lib/auth/admin')return{isAdminUser:async()=>isAdmin};
if(id==='@/lib/supabase/server')return{createClient:async()=>client,createServerClient:async()=>client};if(id==='@/lib/supabase/admin')return{createAdminClient:()=>client};
if(id==='@/lib/ai/provider')return{isAIConfigured:async()=>true,aiChatCompletion:async()=>{modelCalls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({plan:{title:'Plan'},tasks:[{title:'Review'}],flashcards:[{question:'Q',answer:'A'}]})}}]}),{status:providerStatus})}};
if(id==='@/lib/services/learning-graph')return{emitLearningEvent(){}};if(id==='@/lib/services/syllabus')return{describeCurriculumForPrompt:async()=>null};
if(id==='@/lib/polar')return{getPolarCheckout:async()=>checkout,getPolarSubscription:async()=>snapshot,polarFetch:async()=>{discoveryPages++;return new Response(JSON.stringify({items:[snapshot],pagination:{max_page:1}}))}};
if(id.startsWith('@/')){let p=id.slice(2);p+=fs.existsSync(path.join(base,p+'.ts'))?'.ts':fs.existsSync(path.join(base,p+'.tsx'))?'.tsx':'/index.ts';return load(p,base)}return require(id)};
vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:full})(req,mod,mod.exports);return mod.exports;}
const request=(body={},method='POST',headers={})=>new Request('https://app.test/api/test',{method,headers,body:method==='GET'?undefined:JSON.stringify(body)});
async function run(){process.env.POLAR_PRODUCT_ID_GENIUS='genius';process.env.CRON_SECRET='test-cron';process.env.POLAR_WEBHOOK_SECRET='whsec_testsecret';
const routes=[['app/api/ai/generate-study-plan/route.ts',{subjects:'Physics',examDate:'2026-12-01',hoursPerDay:2}],['app/api/ai/analyze-syllabus/route.ts',{syllabusText:'Physics'}],['app/api/stress-relief-chat/route.ts',{messages:[{role:'user',content:'Exam stress'}]}],['app/api/ai/generate-flashcards/route.ts',{content:'Photosynthesis converts light into chemical energy',deckId:'deck1',cardCount:2}],['app/api/ai/task-suggestions/route.ts',{}]];
for(const [file,body] of routes){const route=load(file);user=null;let before=modelCalls;assert.equal((await route.POST(request(body))).status,401);assert.equal(modelCalls,before);
user={id:uid,email:'student@example.test'};for(const [mode,status]of[['deny',429],['error',503],['empty',503]]){quotaMode=mode;assert.equal((await route.POST(request(body))).status,status,file+' '+mode);assert.equal(modelCalls,before)}
quotaMode='allow';assert.equal((await route.POST(request(body))).status,200,file+' success');assert.equal(modelCalls,before+1);
providerStatus=500;let oldRefunds=refunds;assert.ok((await route.POST(request(body))).status>=400);assert.equal(refunds,oldRefunds+1,file+' failed generation must refund');providerStatus=200;}
assert.ok(rpcCalls.some(c=>c.name==='consume_ai_quota_v2'&&c.args.p_feature==='flashcards'&&c.args.p_amount===2));
const {withQuota}=load('lib/services/quota/index.ts');let old=refunds;await withQuota('study_plan',async(_r,ctx)=>{await ctx.refund();return new Response('error',{status:500})})(request());assert.equal(refunds,old+1,'Refund only once');
const verify=load('app/api/subscription/verify-payment/route.ts');checkout.metadata.user_id=other;old=syncCalls;assert.equal((await verify.POST(request({checkoutId:'checkout1'}))).status,403);assert.equal(syncCalls,old);
checkout.metadata.user_id=uid;snapshot.product_id='shop-product';assert.equal((await verify.POST(request({checkoutId:'checkout1'}))).status,400);assert.equal(syncCalls,old);
snapshot.product_id='genius';assert.equal((await verify.POST(request({checkoutId:'checkout1'}))).status,200);assert.equal(firstSnapshot.current_period_end,snapshot.current_period_end,'Use actual provider period');
const webhook=load('app/api/webhooks/polar/route.ts');const raw=JSON.stringify({type:'subscription.updated',data:{id:'sub1',status:'canceled'}}),stamp=String(Math.floor(Date.now()/1000));const headers={'webhook-id':'event1','webhook-timestamp':stamp,'webhook-signature':'v1,'+crypto.createHmac('sha256',process.env.POLAR_WEBHOOK_SECRET).update('event1.'+stamp+'.'+raw).digest('base64')};
const hookReq=h=>new Request('https://app.test/api/webhooks/polar',{method:'POST',headers:h,body:raw});
assert.equal((await webhook.POST(hookReq({}))).status,401);old=syncCalls;assert.equal((await webhook.POST(hookReq(headers))).status,200);assert.equal(syncCalls,old+1,'Verified webhook uses canonical snapshot, not stale payload');
seen=true;assert.equal((await webhook.POST(hookReq(headers))).status,200);assert.equal(syncCalls,old+1);seen=false;logError=true;assert.equal((await webhook.POST(hookReq(headers))).status,503);logError=false;
const expiry=load('app/api/cron/subscription-expiry/route.ts');delete process.env.CRON_SECRET;assert.equal((await expiry.GET(request({},'GET',{authorization:'Bearer undefined'}))).status,401);process.env.CRON_SECRET='test-cron';assert.equal((await expiry.GET(request({},'GET',{authorization:'Bearer test-cron'}))).status,200);
const adminCron=load('app/api/cron/process-subscriptions/route.ts',adminRoot);delete process.env.CRON_SECRET;assert.equal((await adminCron.POST(request({},'POST',{authorization:'Bearer undefined'}))).status,401);process.env.CRON_SECRET='test-cron';assert.equal((await adminCron.GET(request({},'GET',{authorization:'Bearer test-cron'}))).status,200);
isAdmin=false;await assert.rejects(()=>load('app/admin/(protected)/subscriptions/actions.ts',adminRoot).processExpiredSubscriptions(),/Forbidden/);isAdmin=true;
// More than 200 local records, including previously-downgraded Scholar rows.
rows=Array.from({length:205},(_,i)=>({user_id:String(i).padStart(36,'0'),polar_subscription_id:'sub1',polar_checkout_id:null}));
// Local mismatched owner records are failures, but pagination must still visit all of them.
const originalError=console.error;console.error=()=>{};const reconciliation=await load('lib/billing/reconcile.ts').reconcilePolar(client,{dryRun:false});console.error=originalError;
assert.equal(reconciliation.counts.checked,206);assert.equal(discoveryPages,1);assert.ok(rpcCalls.filter(c=>c.name==='finish_billing_job').length===2);
console.log('PASS: all five AI routes reject unauthenticated/over-limit/unavailable checks before model calls; successful calls and failure refunds; checkout ownership/product/real dates; webhook signature/canonical refresh/replay/log failures; secured GET/POST expiry; admin authorization; 205-row scan plus provider discovery.');}
run().catch(e=>{console.error(e);process.exit(1)});
