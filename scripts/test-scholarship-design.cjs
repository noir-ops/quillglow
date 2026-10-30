// Run: node scripts/test-scholarship-design.cjs (no live DB or external requests).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
let user = { id: 'student-1' }, apps = [], writes = 0, detailStatus = null;
const queries = [];
const listing = { id: 'opportunity-1', title: 'Qilly’s Choice Award', provider: 'QuillGlow', opportunity_type: 'scholarship',
  description: 'Support for your next chapter.', award_amount: 250, award_currency: 'USD', deadline: '2026-12-01', is_rolling: false,
  covers: ['tuition'], countries: null, education_level: null, subjects: null, requires_essay: true, requires_recommendation: false,
  status: 'active', review_status: 'approved', metadata: { purpose: 'Tuition support', potential_awardees: 4, logo_url: 'javascript:alert(1)', internal_notes: 'PRIVATE' } };
function query(table) {
  const filters = [], builder = { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, in() { return this; },
    upsert(values, options) {
      assert.equal(options.ignoreDuplicates, true, 'Bookmarks must never overwrite an existing application');
      this.created = apps.some(a => a.user_id === values.user_id && a.opportunity_id === values.opportunity_id)
        ? null : { id: 'new-app', ...values };
      if (this.created) { apps.push(this.created); writes++; }
      return this;
    },
    result() {
      queries.push({ table, filters });
      const rows = table === 'opportunities' ? [listing] : apps;
      const data = rows.filter(row => filters.every(([key, value]) => row[key] === value));
      return { data: 'created' in this ? this.created : data, error: null };
    },
    maybeSingle() { const r = this.result(); return Promise.resolve({ ...r, data: Array.isArray(r.data) ? r.data[0] || null : r.data }); },
    single() { return this.maybeSingle(); }, then(resolve) { return Promise.resolve(this.result()).then(resolve); },
  }; return builder;
}
const supabase = { auth: { getUser: async () => ({ data: { user } }) }, from: query };
function load(relative) {
  const file = path.join(root, relative), mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  function req(id) {
    if (id === 'next/server') return { NextResponse: { json: (data, options) => new Response(JSON.stringify(data), { status: options?.status || 200 }) } };
    if (id === 'next/link') return { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) };
    if (id === 'next/navigation') return { useRouter: () => ({ push() {} }) };
    if (id === '@/lib/supabase/server') return { createClient: async () => supabase };
    if (id === '@/lib/services/opportunities') return { matchOpportunities: async () => [{ opportunity_id: listing.id, title: listing.title, provider: listing.provider, opportunity_type: listing.opportunity_type, award_amount: 250, deadline: listing.deadline, match_score: 20, reasons: { strong_concepts: 1, days_left: 20 } }], refreshOpportunityScores: async () => {}, saveApplication: () => { throw new Error('Unsafe bookmark upsert called'); } };
    if (id === 'react' && relative.endsWith('opportunity-details.tsx')) {
      const state = [listing, detailStatus, false, null, false]; let next = 0;
      return { ...React, useState: () => [state[next++], () => {}], useEffect: () => {}, useCallback: fn => fn };
    }
    if (id.startsWith('@/')) {
      const p = id.slice(2); return load(p + (fs.existsSync(path.join(root, p + '.ts')) ? '.ts' : '.tsx'));
    }
    return require(id);
  }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(req, mod, mod.exports);
  return mod.exports;
}
async function run() {
  const helpers = load('lib/opportunities/presentation.ts');
  assert.equal(helpers.formatAward(250, 'USD'), '$250');
  assert.match(helpers.formatAward(250, 'EUR'), /250/);
  assert.equal(helpers.formatAward(null), null);
  assert.equal(helpers.formatDeadline('2026-12-01'), 'Dec 1, 2026');
  assert.equal(helpers.formatDeadline('invalid'), 'Deadline not listed');
  assert.equal(helpers.formatDeadline('2026-12-01', true), 'Rolling applications');
  assert.equal(helpers.publicListingExtras(listing.metadata).logo_url, null);
  assert.equal(helpers.publicListingExtras({ logo_url: 'https://example.com/logo.png' }).logo_url, 'https://example.com/logo.png');
  assert.equal(helpers.publicListingExtras({ potential_awardees: -1 }).potential_awardees, null);
  const detail = load('app/api/opportunities/detail/[id]/route.ts');
  user = null; assert.equal((await detail.GET(null, { params: Promise.resolve({ id: listing.id }) })).status, 401);
  user = { id: 'student-1' };
  apps = [{ id: 'own-app', user_id: user.id, opportunity_id: listing.id, status: 'submitted', notes: 'Keep my essay' },
    { id: 'other-app', user_id: 'other-student', opportunity_id: listing.id, status: 'in_progress' }];
  const body = await (await detail.GET(null, { params: Promise.resolve({ id: listing.id }) })).json();
  assert.equal(body.application.id, 'own-app');
  assert.equal(body.opportunity.potential_awardees, 4);
  assert.equal(body.opportunity.logo_url, null);
  assert.equal(body.opportunity.metadata, undefined);
  assert.doesNotMatch(JSON.stringify(body.opportunity), /PRIVATE/);
  assert.ok(queries.some(q => q.table === 'opportunities' && q.filters.some(([k,v]) => k === 'review_status' && v === 'approved')));
  listing.review_status = 'draft'; assert.equal((await detail.GET(null, { params: Promise.resolve({ id: listing.id }) })).status, 404); listing.review_status = 'approved';
  const match = load('app/api/opportunities/match/route.ts');
  const matches = await (await match.GET(new Request('https://app.test/api/opportunities/match?type=scholarship'))).json();
  assert.equal(matches.matches[0].application.id, 'own-app');
  assert.equal(matches.matches[0].award_currency, 'USD');
  assert.doesNotMatch(JSON.stringify(matches), /PRIVATE|other-app/);
  const bookmarks = load('app/api/opportunities/applications/route.ts');
  const request = () => new Request('https://app.test/api/opportunities/applications', { method: 'POST', body: JSON.stringify({ opportunityId: listing.id, status: 'saved' }) });
  assert.equal((await (await bookmarks.POST(request())).json()).application.status, 'submitted');
  assert.equal(apps[0].notes, 'Keep my essay'); assert.equal(writes, 0);
  apps = [];
  await bookmarks.POST(request()); await bookmarks.POST(request());
  assert.equal(writes, 1); assert.equal(apps.length, 1);
  const { OpportunityCard } = load('components/sprout/opportunity-card.tsx');
  const cardData = { ...listing, ...helpers.publicListingExtras(listing.metadata), opportunity_id: listing.id, match_score: 20, reasons: { strong_concepts: 1, days_left: 20 } };
  for (const [status, label] of [[null, 'Apply now'], ['saved', 'Apply now'], ['in_progress', 'Continue application'], ['submitted', 'View application']]) {
    const html = renderToStaticMarkup(React.createElement(OpportunityCard, { opportunity: { ...cardData, application: status ? { id: 'a', status } : null }, onSave() {}, onApply() {} }));
    assert.ok(html.includes(label)); assert.ok(html.includes('$250')); assert.ok(html.includes('/opportunities/opportunity-1'));
    if (status === 'submitted') assert.ok(!html.includes('>Save<'));
  }
  for (const [status, label, cancel] of [[null, 'Apply now', false], ['in_progress', 'Continue application', true], ['submitted', 'View application', true], ['awarded', 'View application', false]]) {
    detailStatus = status ? { id: 'a', status } : null;
    const { OpportunityDetails } = load('components/sprout/opportunity-details.tsx');
    const html = renderToStaticMarkup(React.createElement(OpportunityDetails, { opportunityId: listing.id }));
    assert.ok(html.includes(label)); assert.ok(html.includes('Summary')); assert.ok(html.includes('Guide'));
    assert.equal(html.includes('Cancel application') || html.includes('Withdraw application'), cancel);
  }
  console.log('PASS: currency/date formatting, metadata safety, approved-only own-account details and matches, idempotent bookmarks preserve submitted essays, card/detail rendering and status-aware actions.');
}
run().catch(e => { console.error(e); process.exit(1); });
