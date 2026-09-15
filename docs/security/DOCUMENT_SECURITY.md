# Document Security — §23

Scholarship applications carry passports, transcripts and financial records
belonging to minors. This is the highest-sensitivity data on the platform.

## The rule

**`storage_path` never leaves the server.** Clients only ever see an opaque
document id.

```
Student → Application → Secure Document ID → Authorization Check
        → Short-lived Signed URL (60s) → Document
```

Never `/student/uploads/passport.pdf`.

## How it's enforced

- **Random storage paths** — `{ownerId}/{uuid}.{ext}`, never derived from the
  filename, so documents can't be found by guessing.
- **Private bucket** — no public URLs exist at all.
- **60-second signed URLs** — long enough to open, short enough that a leaked
  URL is dead before it's useful.
- **Client-safe projection** — the service selects an explicit field list that
  excludes `storage_path`; it cannot leak through a `select *`.
- **`Cache-Control: no-store`** on the signed-URL response, so a signed URL never
  lands in a shared cache.
- **404 for both denied and missing.** Distinguishing them would turn the API
  into an oracle for which document ids exist.

## Who can see a document

| Requester | Allowed |
|---|---|
| Owner | ✅ |
| Admin | ✅ |
| Mentor with `scholarship.review` | ✅ |
| Benefactor **of that opportunity** | ✅ |
| Any other benefactor | ❌ |
| Any other student | ❌ |

The benefactor rule is narrow on purpose: a benefactor sees documents attached to
applications for **their own** scholarships only — never a student's documents in
general.

**Verified: 16/16**, including a different benefactor being correctly denied,
expired documents denied even to their owner, and soft-deleted documents
returning `not_found`.

## Audit

Every issued URL **and every denial** is logged with accessor, role, reason, IP
and user agent. For scholarship-grade data you must be able to answer "who
viewed this passport, and when?"

## Retention

`expires_at` supports retention rules; `expire_old_documents()` soft-deletes
past-expiry records. Run it on the same schedule as the event worker.

## Setup

Create a **private** Supabase storage bucket named `secure-documents`
(Dashboard → Storage → New bucket → uncheck "Public bucket").

```bash
SECURE_DOCUMENTS_BUCKET=secure-documents
```

> If the bucket is public, everything above is bypassed. Verify it is private
> before any real student document is uploaded.
