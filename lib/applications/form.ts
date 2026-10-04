/**
 * Scholarship application form — shared by the form UI (live validation,
 * section completion badges) and the submit API (the authoritative check).
 * One definition, so the browser and server can never disagree about what
 * "complete" means.
 */

export type YesNo = "yes" | "no" | ""

export interface ApplicationFormData {
  personal: {
    fullName: string
    dateOfBirth: string
    gender: "male" | "female" | ""
    nationality: string
    email: string
    phone: string
    address: string
    countryOfResidence: string
  }
  academic: {
    educationLevel: "high_school" | "undergraduate" | "graduate" | ""
    institution: string
    institutionCountry: string
    fieldOfStudy: string
    gpa: string
    graduationYear: string
  }
  statement: {
    text: string
  }
  financial: {
    needBased: boolean
    incomeBracket: "below_5k" | "5k_10k" | "10k_20k" | "above_20k" | ""
    dependents: string
    hasOtherAid: YesNo
    otherAid: string
  }
  activities: {
    hasAwards: YesNo
    awards: string
    hasVolunteering: YesNo
    volunteering: string
    extracurriculars: string
  }
  references: {
    ref1: { name: string; relationship: string; email: string }
    ref2: { name: string; relationship: string; email: string }
  }
  review: {
    confirmAccurate: boolean
    agreeTerms: boolean
  }
}

export type SectionKey = "personal" | "academic" | "scholarship" | "financial" | "activities" | "references" | "review"

export const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: "personal", title: "Personal Information" },
  { key: "academic", title: "Academic Information" },
  { key: "scholarship", title: "Scholarship Details" },
  { key: "financial", title: "Financial Information" },
  { key: "activities", title: "Extracurricular Activities & Achievements" },
  { key: "references", title: "References & Recommendation Letters" },
  { key: "review", title: "Review & Submission" },
]

/** Upload slots, mapped onto the existing secure_documents document types. */
export const UPLOAD_SLOTS = {
  governmentId: { documentType: "national_id", label: "Government-issued ID" },
  transcript: { documentType: "transcript", label: "Academic transcripts" },
  statement: { documentType: "essay", label: "Personal statement (PDF/DOC)" },
  financial: { documentType: "financial_statement", label: "Financial documentation" },
  recommendation: { documentType: "recommendation", label: "Recommendation letters" },
} as const

export const STATEMENT_WORD_LIMIT = 500

export const INCOME_BRACKETS = [
  { value: "below_5k", label: "Below $5,000" },
  { value: "5k_10k", label: "$5,000 – $10,000" },
  { value: "10k_20k", label: "$10,000 – $20,000" },
  { value: "above_20k", label: "Above $20,000" },
] as const

export const EDUCATION_LEVELS = [
  { value: "high_school", label: "High School Student" },
  { value: "undergraduate", label: "Undergraduate Student" },
  { value: "graduate", label: "Graduate Student" },
] as const

export function emptyForm(): ApplicationFormData {
  const ref = { name: "", relationship: "", email: "" }
  return {
    personal: {
      fullName: "",
      dateOfBirth: "",
      gender: "",
      nationality: "",
      email: "",
      phone: "",
      address: "",
      countryOfResidence: "",
    },
    academic: { educationLevel: "", institution: "", institutionCountry: "", fieldOfStudy: "", gpa: "", graduationYear: "" },
    statement: { text: "" },
    financial: { needBased: false, incomeBracket: "", dependents: "", hasOtherAid: "", otherAid: "" },
    activities: { hasAwards: "", awards: "", hasVolunteering: "", volunteering: "", extracurriculars: "" },
    references: { ref1: { ...ref }, ref2: { ...ref } },
    review: { confirmAccurate: false, agreeTerms: false },
  }
}

/**
 * Merges whatever is stored with a full empty form, so an older or partial
 * draft never crashes the UI with a missing nested object.
 */
export function normaliseForm(raw: unknown): ApplicationFormData {
  const base = emptyForm()
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>
  return {
    personal: { ...base.personal, ...(r.personal ?? {}) },
    academic: { ...base.academic, ...(r.academic ?? {}) },
    statement: { ...base.statement, ...(r.statement ?? {}) },
    financial: { ...base.financial, ...(r.financial ?? {}) },
    activities: { ...base.activities, ...(r.activities ?? {}) },
    references: {
      ref1: { ...base.references.ref1, ...(r.references?.ref1 ?? {}) },
      ref2: { ...base.references.ref2, ...(r.references?.ref2 ?? {}) },
    },
    review: { ...base.review, ...(r.review ?? {}) },
  }
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const blank = (v: unknown) => typeof v !== "string" || v.trim() === ""

export interface ValidationContext {
  /** Document types already uploaded against this application. */
  uploadedTypes: string[]
  requiresRecommendation: boolean
}

export interface ValidationResult {
  valid: boolean
  errors: Record<SectionKey, string[]>
}

export function validateApplication(form: ApplicationFormData, ctx: ValidationContext): ValidationResult {
  const errors: Record<SectionKey, string[]> = {
    personal: [],
    academic: [],
    scholarship: [],
    financial: [],
    activities: [],
    references: [],
    review: [],
  }
  const has = (type: string) => ctx.uploadedTypes.includes(type)

  // 1. Personal
  const p = form.personal
  if (blank(p.fullName)) errors.personal.push("Full name is required")
  if (blank(p.dateOfBirth)) errors.personal.push("Date of birth is required")
  else if (Number.isNaN(Date.parse(p.dateOfBirth)) || new Date(p.dateOfBirth) >= new Date())
    errors.personal.push("Date of birth must be a valid past date")
  if (!p.gender) errors.personal.push("Gender is required")
  if (blank(p.nationality)) errors.personal.push("Nationality is required")
  if (blank(p.email)) errors.personal.push("Email address is required")
  else if (!EMAIL_RE.test(p.email.trim())) errors.personal.push("Email address is not valid")
  if (blank(p.phone)) errors.personal.push("Phone number is required")
  else if (p.phone.replace(/\D/g, "").length < 7) errors.personal.push("Phone number looks too short")
  if (blank(p.address)) errors.personal.push("Home address is required")
  if (blank(p.countryOfResidence)) errors.personal.push("Country of residence is required")
  if (!has(UPLOAD_SLOTS.governmentId.documentType)) errors.personal.push("Upload a government-issued ID")

  // 2. Academic
  const a = form.academic
  if (!a.educationLevel) errors.academic.push("Current education level is required")
  if (blank(a.institution)) errors.academic.push("Institution name is required")
  if (blank(a.institutionCountry)) errors.academic.push("Country of institution is required")
  if (blank(a.fieldOfStudy)) errors.academic.push("Field of study is required")
  if (blank(a.gpa)) errors.academic.push("Current GPA / academic performance is required")
  if (blank(a.graduationYear)) errors.academic.push("Expected graduation year is required")
  else {
    const y = Number(a.graduationYear)
    const now = new Date().getFullYear()
    if (!Number.isInteger(y) || y < now - 1 || y > now + 10) errors.academic.push("Expected graduation year looks wrong")
  }
  if (!has(UPLOAD_SLOTS.transcript.documentType)) errors.academic.push("Upload your academic transcripts")

  // 3. Scholarship — personal statement (text required, upload optional)
  const words = wordCount(form.statement.text)
  if (words === 0) errors.scholarship.push("Personal statement is required")
  else if (words > STATEMENT_WORD_LIMIT)
    errors.scholarship.push(`Personal statement must be ${STATEMENT_WORD_LIMIT} words or fewer (currently ${words})`)

  // 4. Financial — only required when applying as need-based
  const f = form.financial
  if (f.needBased) {
    if (!f.incomeBracket) errors.financial.push("Family income bracket is required")
    if (blank(f.dependents)) errors.financial.push("Number of dependents is required")
    else if (!/^\d+$/.test(f.dependents.trim())) errors.financial.push("Number of dependents must be a whole number")
    if (!f.hasOtherAid) errors.financial.push("Tell us whether you have other scholarships or aid")
    if (f.hasOtherAid === "yes" && blank(f.otherAid)) errors.financial.push("List your current scholarships and amounts")
    if (!has(UPLOAD_SLOTS.financial.documentType)) errors.financial.push("Upload financial documentation")
  }

  // 5. Activities
  const act = form.activities
  if (!act.hasAwards) errors.activities.push("Tell us whether you've received academic or leadership awards")
  if (act.hasAwards === "yes" && blank(act.awards)) errors.activities.push("List your awards")
  if (!act.hasVolunteering) errors.activities.push("Tell us whether you're involved in volunteering")
  if (act.hasVolunteering === "yes" && blank(act.volunteering)) errors.activities.push("Describe your volunteering")

  // 6. References — reference 1 required; reference 2 optional but all-or-nothing
  const r1 = form.references.ref1
  if (blank(r1.name) || blank(r1.relationship) || blank(r1.email))
    errors.references.push("Complete all fields for Reference 1")
  else if (!EMAIL_RE.test(r1.email.trim())) errors.references.push("Reference 1 email is not valid")
  const r2 = form.references.ref2
  const r2Any = !blank(r2.name) || !blank(r2.relationship) || !blank(r2.email)
  if (r2Any) {
    if (blank(r2.name) || blank(r2.relationship) || blank(r2.email))
      errors.references.push("Complete all fields for Reference 2, or leave it empty")
    else if (!EMAIL_RE.test(r2.email.trim())) errors.references.push("Reference 2 email is not valid")
  }
  if (ctx.requiresRecommendation && !has(UPLOAD_SLOTS.recommendation.documentType))
    errors.references.push("This scholarship requires a recommendation letter upload")

  // 7. Review
  if (!form.review.confirmAccurate) errors.review.push("Confirm that your information is accurate")
  if (!form.review.agreeTerms) errors.review.push("Agree to the scholarship terms and conditions")

  const valid = Object.values(errors).every((e) => e.length === 0)
  return { valid, errors }
}
