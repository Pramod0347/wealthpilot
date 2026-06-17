import { useState } from 'react'
import Logo from '../Logo'

const ACCESS_MESSAGE = 'Enter the owner email and phone number to continue.'

type LoginPageProps = {
  expectedEmail: string
  expectedPhone: string
  onUnlock: () => void
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

export default function LoginPage({ expectedEmail, expectedPhone, onUnlock }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPhone = normalizePhone(phone)

    if (normalizedEmail !== expectedEmail.trim().toLowerCase() || normalizedPhone !== normalizePhone(expectedPhone)) {
      setError('Access denied. Enter the configured owner email and phone number.')
      return
    }

    setError(null)
    onUnlock()
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center gap-4">
          <Logo />
          <div>
            <div className="text-2xl font-bold tracking-[-0.03em] text-slate-900 dark:text-white">WealthPilot</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Personal Finance</div>
          </div>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">
            Continue to WealthPilot
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {ACCESS_MESSAGE}
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        ) : null}

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-slate-600 dark:text-slate-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter owner email"
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition-colors focus:border-accent-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-slate-600 dark:text-slate-300">Phone Number</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Enter owner phone number"
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition-colors focus:border-accent-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white"
              autoComplete="tel"
              required
            />
          </label>

          <button
            type="submit"
            className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700 active:scale-[0.99]"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  )
}
