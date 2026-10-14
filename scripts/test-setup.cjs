// Run with node scripts/test-setup.cjs after npm ci. No live API calls.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const root = path.resolve(__dirname, '..'), modules = new Map();
let config, calls = [], rows = [], updates = [], allowed = true, status = 202;
let user = { email: 'learner@example.net', email_confirmed_at: '2026-01-01' };
const db = {
 from() { return { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: config }), update(p) { updates.push(p); return this }, then(r) { return Promise.resolve({ error: null }).then(r) } } },
 rpc: async (n) => ({ data: n === 'claim_notification_emails' ? rows : n === 'notification_email_allowed' ? allowed : null, error: null }),
 auth: { admin: { getUserById: async () => ({ data: { user }, error: null }) } },
};
function load(file) {
 file = path.resolve(file); if (modules.has(file)) return modules.get(file).exports;
 const mod = { exports: {} }; modules.set(file, mod);
 const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 function req(id) {
  if (id === 'server-only') return {};
  if (id === '@/lib/supabase/admin') return { createAdminClient: () => db };
  if (id.startsWith('@/') || id.startsWith('.')) {
   let f = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(file), id);
   if (!path.extname(f)) f = fs.existsSync(f + '.ts') ? f + '.ts' : path.join(f, 'index.ts'); return load(f);
  } return require(id);
 }
 vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(req, mod, mod.exports); return mod.exports;
}
const source = f => load(path.join(root, f));
async function run() {
 const provider = source('lib/ai/provider.ts'), { normalizeOpenSourceBaseUrl: normalize } = source('lib/ai/opensource.ts'), { safeAuthNext } = source('lib/auth/redirect.ts');
 assert.equal(normalize(' https://models.example/v1/// '), 'https://models.example/v1');
 for (const bad of ['ftp://x','https://key:secret@x/v1','https://x/v1?key=a','https://x/v1/chat/completions']) assert.throws(() => normalize(bad));
 for (const bad of ['https://evil.example','//evil.example','/\\evil.example','/x\nLocation: evil']) assert.equal(safeAuthNext(bad), '/dashboard');
 assert.equal(safeAuthNext('/auth/reset-password'), '/auth/reset-password');
 config = { active_provider: 'opensource', opensource_base_url: 'https://models.example/v1/', opensource_model: 'test-llama' };
 process.env.OPEN_SOURCE_MODEL_API_KEY = 'endpoint-key';
 global.fetch = async (url, options) => { calls.push({ url, options, body: JSON.parse(options.body) }); return new Response(JSON.stringify({ choices: [{ message: { content: 'Hello' } }], usage: { prompt_tokens: 5, completion_tokens: 1 } })); };
 assert.equal((await (await provider.aiChatCompletion({ messages: [{ role: 'user', content: 'hi' }] })).json()).choices[0].message.content, 'Hello');
 assert.equal(calls.at(-1).url, 'https://models.example/v1/chat/completions'); assert.equal(calls.at(-1).body.model, 'test-llama'); assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer endpoint-key');
 const gateway = source('lib/ai/gateway/index.ts').aiGateway;
 assert.equal((await gateway.execute({ task: 'exam_generation', messages: [{ role: 'user', content: 'Generate' }], json: true })).model, 'test-llama');
 assert.equal(calls.at(-1).body.response_format.type, 'json_object'); assert.equal(calls.some(c => c.url.includes('openai.com') || c.url.includes('googleapis.com')), false);
 delete process.env.OPEN_SOURCE_MODEL_API_KEY;
 await provider.aiChatCompletion({ messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }] }] }, { needsVision: true });
 assert.equal('Authorization' in calls.at(-1).options.headers, false); assert.equal(calls.at(-1).body.messages[0].content[0].type, 'image_url');
 const { streamAI } = source('lib/ai/gateway/streaming.ts');
 global.fetch = async (url, options) => { calls.push({ url, options, body: JSON.parse(options.body) }); return new Response(new ReadableStream({ start(c) { for (const ch of ['data: {"choices":[{"delta":{"con','tent":"Hello stream"}}]}\n','data: [DONE]\n']) c.enqueue(new TextEncoder().encode(ch)); c.close() } })); };
 assert.equal(await (await streamAI({ task: 'tutoring', messages: [{ role: 'user', content: 'hi' }] })).text(), 'Hello stream'); assert.equal(calls.at(-1).body.model, 'test-llama'); assert.equal(calls.at(-1).body.stream, true);
 global.fetch = async () => new Response(JSON.stringify({ choices: [] })); assert.equal((await provider.aiChatCompletion({ messages: [] })).status, 502);
 config = { active_provider: 'openai' }; provider.clearAIProviderConfigCache(); process.env.OPENAI_API_KEY = 'test-openai';
 global.fetch = async (url, options) => { calls.push({ url, options, body: JSON.parse(options.body) }); return new Response(JSON.stringify({ choices: [{ message: { content: 'OpenAI' } }] })); };
 await gateway.execute({ task: 'tutoring', messages: [{ role: 'user', content: 'Hi' }], cacheable: false }); assert.equal(calls.at(-1).url, 'https://api.openai.com/v1/chat/completions');
 const { deliverNotificationEmails, notificationLink } = source('lib/services/notifications/email.ts');
 assert.equal(notificationLink('//evil.example', 'https://app.example'), null); assert.equal(notificationLink('/\\evil.example', 'https://app.example'), null); assert.equal(notificationLink('/wallet', 'https://app.example'), 'https://app.example/wallet');
 assert.equal((await deliverNotificationEmails()).configured, false);
 process.env.MAILERSEND_API_KEY = 'email-key'; process.env.MAILERSEND_FROM_EMAIL = 'updates@example.org'; process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
 rows = [{ id: 1, notification_id: 2, user_id: 'u1', category: 'scholarship', title: 'Award <script>', body: '<b>Congrats</b>', action_url: '//evil.example', metadata: {}, attempts: 1, lock_token: 'lease' }];
 global.fetch = async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return new Response(null, { status, headers: { 'x-message-id': 'message-1' } }); };
 assert.equal((await deliverNotificationEmails()).accepted, 1); assert.equal(updates.at(-1).status, 'sent'); assert.match(calls.at(-1).body.html, /&lt;script&gt;/); assert.equal(calls.at(-1).body.html.includes('evil.example'), false);
 allowed = false; const before = calls.length; assert.equal((await deliverNotificationEmails()).skipped, 1); assert.equal(calls.length, before);
 allowed = true; user.email_confirmed_at = null; assert.equal((await deliverNotificationEmails()).skipped, 1);
 user.email_confirmed_at = '2026-01-01'; status = 429; await deliverNotificationEmails(); assert.equal(updates.at(-1).status, 'pending');
 status = 422; await deliverNotificationEmails(); assert.equal(updates.at(-1).status, 'failed');
 status = 500; rows[0].attempts = 5; await deliverNotificationEmails(); assert.equal(updates.at(-1).status, 'failed');
 console.log('PASS: direct/task/JSON/image/streamed AI routing, legacy OpenAI routing, endpoint validation, safe redirects, verified recipients, opt-outs, escaped email, bounded retries.');
}
run().catch(e => { console.error(e); process.exit(1) });
