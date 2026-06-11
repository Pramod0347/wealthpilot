export default function Logo() {
  return (
    <div className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-accent-400 to-accent-700 text-white shadow-lg shadow-accent-600/30">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M3 17l5-5 4 3 6-7" />
        <path d="M14 8h4v4" />
      </svg>
    </div>
  )
}
