/** Decorative illustration, deliberately separate from real location data. */
export function CourtArt() {
  return <svg viewBox="0 0 360 240" fill="none" aria-hidden="true" className="court-art">
    <ellipse cx="181" cy="211" rx="139" ry="15" fill="#142f48" opacity=".06" />
    <path d="M71 45 311 76 270 206 30 173Z" fill="#185adc" />
    <path d="m85 61 205 26-32 99-205-26Z" stroke="white" strokeWidth="2.5" />
    <path d="m71 111 205 27m-98-64-33 100m-80-33 204 26" stroke="white" strokeWidth="2" />
    <path d="m164 56-34 130" stroke="#142f48" strokeWidth="4" />
    <path d="m166 48-35 129" stroke="#142f48" strokeWidth="2" />
    <path d="m167 49-1 15-35 122 2-16Z" fill="white" opacity=".8" />
    <circle cx="284" cy="46" r="23" fill="#ffd269" />
    <path d="M267 31c13 7 19 20 15 37m19-36c-13 7-19 20-15 36" stroke="#a86b00" strokeWidth="2" />
    <g transform="translate(48 15) rotate(-18)">
      <path d="M0 0h43l-5 47H5Z" fill="white" stroke="#142f48" strokeWidth="2" />
      <path d="M4 17h35l-3 28H7Z" fill="#bee9f2" />
      <path d="M43 9h7c12 0 12 21-2 21h-7" stroke="#142f48" strokeWidth="3" />
      <path d="M14-7c-5-6 6-10 1-16m15 16c-5-6 6-10 1-16" stroke="#185adc" strokeWidth="2" strokeLinecap="round" />
    </g>
    <path d="m303 151 9 5-9 5-5 9-5-9-9-5 9-5 5-9Z" fill="#ffd269" />
  </svg>;
}
