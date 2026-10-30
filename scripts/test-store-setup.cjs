// Run: node scripts/test-store-setup.cjs. No network or payment calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');let user={id:'account1',email:'learner@outlook.com',email_confirmed_at:'yes'},subscribed=false,persisted,paymentCalled=false;
function load(file){const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function req(id){if(id==='next/server')return{NextResponse:{json:(data,opts)=>new Response(JSON.stringify(data),{status:opts?.status||200})}};
if(id==='next/navigation')return{redirect:url=>{throw new Error('REDIRECT:'+url)}};
if(id==='next/headers')return{headers:async()=>({get:()=>''})};
if(id==='@/components/store/storefront')return{default:()=>null};
if(id==='@/lib/polar')return{createPolarCheckout:()=>{paymentCalled=true}};
if(id==='@/lib/supabase/server')return{createClient:async()=>({auth:{getUser:async()=>({data:{user}})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{subscribed},error:null})})})};
if(id==='@/lib/supabase/admin')return{createAdminClient:()=>({rpc:async(name,args)=>{persisted={name,args};subscribed=args.p_subscribed;return{data:subscribed,error:null}}})};
if(id.startsWith('@/')){let f=path.join(root,id.slice(2));f+=fs.existsSync(f+'.ts')?'.ts':'.tsx';return load(f)}return require(id)};
vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename:file})(req,mod,mod.exports);return mod.exports}
async function run(){const source=f=>load(path.join(root,f));const api=source('app/api/store/notifications/route.ts');const request=data=>new Request('https://app.example/api/store/notifications',{method:'PUT',body:JSON.stringify(data)});
user=null;assert.equal((await api.GET()).status,401);assert.equal((await api.PUT(request({subscribed:true}))).status,401);
user={id:'account1',email:'learner@outlook.com',email_confirmed_at:null};assert.equal((await api.PUT(request({subscribed:true}))).status,400);assert.equal(persisted,undefined);
user.email_confirmed_at='yes';assert.equal((await api.PUT(request({subscribed:'yes'}))).status,400);
assert.equal((await api.PUT(request({subscribed:true,user_id:'other',email:'someone@else.net'}))).status,200);assert.equal(persisted.args.p_user_id,'account1');assert.equal((await (await api.GET()).json()).email,'learner@outlook.com');assert.equal((await (await api.GET()).json()).subscribed,true);
assert.equal((await api.PUT(request({subscribed:false}))).status,200);assert.equal(subscribed,false);
assert.equal((await api.PUT(new Request('https://x',{method:'PUT',body:'invalid'}))).status,400);
for(const file of ['app/shop/page.tsx','app/store/page.tsx'])assert.throws(()=>source(file).default(),/REDIRECT:\/store\/coming-soon/);
await assert.rejects(source('app/actions/polar.ts').startCheckoutSession('test'),/New purchases are paused/);assert.equal(paymentCalled,false);
assert.equal((await source('app/api/shop/pay-with-family-wallet/route.ts').POST(request({}))).status,503);
console.log('PASS: Store routes redirect, guest/unverified access handling, explicit subscription validation, own-account signup/cancellation, malformed request handling, new Polar/family-wallet purchases paused.');}
run().catch(e=>{console.error(e);process.exit(1)});
