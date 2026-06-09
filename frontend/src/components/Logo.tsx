export default function Logo() {
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[6px] bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-700)] text-white shadow-[0_18px_50px_rgba(13,148,136,0.25)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M3 17l5-5 4 3 6-7" />
        <path d="M14 8h4v4" />
      </svg>
    </div>
  )
}
