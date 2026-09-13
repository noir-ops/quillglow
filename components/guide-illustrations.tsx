"use client"

export function FamilyIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 260" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Heart backdrop */}
      <path
        d="M130 220C130 220 30 160 30 95C30 60 57 35 90 35C108 35 123 44 130 58C137 44 152 35 170 35C203 35 230 60 230 95C230 160 130 220 130 220Z"
        fill="#EDE9FF"
      />
      {/* Dad — right, green */}
      <g>
        <rect x="150" y="150" width="70" height="70" rx="30" fill="#10B981" />
        <circle cx="185" cy="128" r="30" fill="#F5C99B" />
        <path d="M158 118C158 100 170 88 185 88C200 88 212 100 212 118C212 108 200 100 185 100C170 100 158 108 158 118Z" fill="#3B2A20" />
      </g>
      {/* Mum — left, purple */}
      <g>
        <rect x="55" y="145" width="70" height="75" rx="30" fill="#7C3AED" />
        <circle cx="90" cy="122" r="30" fill="#F5C99B" />
        <path d="M63 130C60 100 72 82 90 82C108 82 120 100 117 130C114 112 104 96 90 96C76 96 66 112 63 130Z" fill="#4A2E1A" />
      </g>
      {/* Kid — front centre, orange */}
      <g>
        <rect x="102" y="168" width="56" height="52" rx="24" fill="#F59E0B" />
        <circle cx="130" cy="150" r="24" fill="#FBD5A5" />
        <path d="M108 145C106 128 116 116 130 116C144 116 154 128 152 145C150 132 141 124 130 124C119 124 110 132 108 145Z" fill="#3B2A20" />
      </g>
    </svg>
  )
}

export function DashboardIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="240" height="180" rx="24" fill="#F3EEFF" transform="rotate(-3 130 100)" />
      <rect x="24" y="26" width="212" height="150" rx="18" fill="#FFFFFF" transform="rotate(-3 130 100)" />

      {/* Line chart */}
      <g transform="rotate(-3 130 100)">
        <polyline
          points="42,110 70,90 96,100 122,68 148,84 176,54"
          stroke="#EC4899"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="176" cy="54" r="5" fill="#EC4899" />
      </g>

      {/* Donut chart */}
      <g transform="rotate(-3 130 100) translate(150 60)">
        <circle cx="40" cy="30" r="26" fill="#FFF0F8" />
        <path d="M40 4 A26 26 0 0 1 63 42 L40 30 Z" fill="#EC4899" />
        <path d="M63 42 A26 26 0 1 1 40 4 L40 30 Z" fill="#EDE9FF" />
        <circle cx="40" cy="30" r="12" fill="#FFFFFF" />
      </g>

      {/* Bar chart group 1 */}
      <g transform="rotate(-3 130 100) translate(38 118)">
        <rect x="0" y="24" width="12" height="24" rx="4" fill="#C4B5FD" />
        <rect x="18" y="12" width="12" height="36" rx="4" fill="#7C3AED" />
        <rect x="36" y="30" width="12" height="18" rx="4" fill="#C4B5FD" />
      </g>

      {/* Bar chart group 2 */}
      <g transform="rotate(-3 130 100) translate(146 118)">
        <rect x="0" y="18" width="12" height="30" rx="4" fill="#C4B5FD" />
        <rect x="18" y="0" width="12" height="48" rx="4" fill="#7C3AED" />
        <rect x="36" y="26" width="12" height="22" rx="4" fill="#C4B5FD" />
      </g>
    </svg>
  )
}

export function GraduationIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Books */}
      <rect x="20" y="82" width="80" height="16" rx="4" fill="#10B981" />
      <rect x="24" y="66" width="72" height="16" rx="4" fill="#FFFFFF" stroke="#E9E4FF" strokeWidth="2" />
      <rect x="28" y="50" width="64" height="16" rx="4" fill="#F3EEFF" />

      {/* Graduation cap */}
      <g>
        <rect x="50" y="18" width="20" height="18" rx="2" fill="#5B21B6" />
        <path d="M60 6L104 26L60 46L16 26L60 6Z" fill="#7C3AED" />
        <path d="M60 46L96 30V44C96 50 80 56 60 56C40 56 24 50 24 44V30L60 46Z" fill="#6D28D9" />
        <line x1="104" y1="26" x2="104" y2="48" stroke="#5B21B6" strokeWidth="2" />
        <circle cx="104" cy="50" r="4" fill="#F59E0B" />
      </g>
    </svg>
  )
}
