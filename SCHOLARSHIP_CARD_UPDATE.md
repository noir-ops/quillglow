# Scholarship card and details update

The scholarship listing now has responsive two-column desktop / single-column
phone cards, larger headings and award amounts, sponsor identity, deadlines,
clear actions, and real saved/application states. The new
`/opportunities/[id]` page follows the supplied reference structure: sponsor,
purpose/type, award, due date, potential awardees, summary, application actions,
and a Guide section. The existing application form remains unchanged.

The earlier collapsed Learn → Study Planner change is included in this ZIP.

## Deployment

Deploy the main app only. No new environment variables, database migration,
payment configuration, email configuration, or admin deployment is required
for this design update. Keep all setup from `BEFORE_DEPLOY.md` in place.

The existing listing `description`, `provider`, `award_amount`,
`award_currency`, `deadline`, `covers`, and requirement fields drive the UI.
Missing values are clearly marked rather than invented. Match percentages
remain profile-match scores, not a claim that funding or eligibility is guaranteed.

Optional sponsor details can be supplied in the existing opportunities.metadata
JSON by an authorized administrator or sponsor editing their listing:

```json
{
  "logo_url": "https://your-domain.example/sponsor-logo.png",
  "purpose": "Support for tuition and learning materials",
  "potential_awardees": 4
}
```

These are optional display fields, not new columns. Only these three metadata
values are exposed; internal notes and unrelated metadata remain server-side.
Only valid HTTPS logo URLs are accepted. Missing/broken logos use sponsor
initials. Missing awardee counts display “Not specified by sponsor”; counts
are never inferred from allocated money or number of applications.

## Application and Guide behavior

- Save for later is idempotent and never downgrades a submitted application or
  overwrites its answers, including a Save/Apply race across tabs.
- Existing applications show Continue application or View application.
- Cancel on an in-progress draft uses the existing DELETE endpoint and asks
  for confirmation before deleting its answers.
- Submitted/shortlisted applications use the existing Withdraw action instead;
  awarded/rejected/withdrawn records are view-only here.
- “Guide” is the terminology used in the scholarship details section.

**Guide assignment is not implemented by this design change.** The supplied
codebase has no per-application Guide assignment table/column/workflow. The
details section therefore shows an honest unassigned state. It does not confuse
family mentor connections or the listing's approving admin with an application
Guide. Real assigned names and automatic updates require a separate protected
assignment workflow in the database and admin panel.

## Verification

- Production build passed with build-only placeholder Supabase variables.
- `node scripts/test-scholarship-design.cjs` passed: public metadata allowlist,
  currencies/dates, approved listing visibility, own-account application state,
  idempotent bookmarks, submitted-essay preservation, rendered card/detail
  states and cancellation visibility.
- Existing AI/auth/email setup and Store regression scripts passed.
- No TypeScript errors were reported in the changed scholarship files; the
  repository still has unrelated pre-existing type errors and its existing
  Next.js configuration skips full type validation during production builds.
- Full browser/viewport checks were not completed: the browser download was
  corrupt and the alternate browser failed to initialize in this environment.
  Check phone/desktop and light/dark layouts on staging before production.
- No live Supabase, scholarship applications, payment, or email data was changed.
